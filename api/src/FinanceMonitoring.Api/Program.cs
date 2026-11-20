using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using FinanceMonitoring.Api.Common.Endpoints;
using FinanceMonitoring.Api.Data;
using FinanceMonitoring.Api.Data.Seeding;
using FinanceMonitoring.Api.Features.Rates;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// On AWS Lambda (behind a Function URL) this swaps Kestrel for the Lambda
// runtime; everywhere else (local dev, tests, a container) it does nothing.
builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);

// The public demo sits behind Vercel's /api rewrite, so the client's IP
// arrives in X-Forwarded-For. It's used only to partition the rate limiter
// below; it's spoofable by anyone calling the function URL directly, which is
// why real abuse protection would be AWS WAF or API Gateway throttling.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

// A public API needs a ceiling: per-client fixed window, 429 + Retry-After.
var permitsPerMinute = builder.Configuration.GetValue("RateLimiting:PermitsPerMinute", 120);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = permitsPerMinute, Window = TimeSpan.FromMinutes(1) }));
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.Headers.RetryAfter = "60";
        await context.HttpContext.RequestServices.GetRequiredService<IProblemDetailsService>().WriteAsync(new ProblemDetailsContext
        {
            HttpContext = context.HttpContext,
            ProblemDetails = { Status = StatusCodes.Status429TooManyRequests, Title = "Too many requests. Try again in a minute." },
        });
    };
});

builder.Services.AddProblemDetails(options =>
    // Validation error keys match the JSON field names ("amount", not "Amount"),
    // so clients can map each error straight onto its form field.
    options.CustomizeProblemDetails = context =>
    {
        if (context.ProblemDetails is HttpValidationProblemDetails validation)
        {
            var camelCased = validation.Errors.ToDictionary(
                pair => JsonNamingPolicy.CamelCase.ConvertName(pair.Key), pair => pair.Value);
            validation.Errors.Clear();
            foreach (var (key, messages) in camelCased) validation.Errors[key] = messages;
        }
    });

// Validates DataAnnotations / IValidatableObject on endpoint parameters and
// returns a 400 ValidationProblem before the handler runs.
builder.Services.AddValidation();
builder.Services.AddOpenApi(options =>
{
    // REPR nests a Request/Response in every endpoint class; prefix schema names
    // with that class (ListCategories.Response → "ListCategoriesResponse") so
    // they can't collide.
    options.CreateSchemaReferenceId = info =>
    {
        var id = OpenApiOptions.CreateDefaultSchemaReferenceId(info);
        return id is not null && info.Type.DeclaringType is { } endpoint ? endpoint.Name + id : id;
    };
});
builder.Services.AddSingleton(TimeProvider.System);

// Enums travel as "Income"/"Expense" (not 0/1), in JSON and in the OpenAPI schema.
// Numbers are strict: an amount is always a JSON number, never "8250".
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
});

builder.Services.AddDbContext<AppDbContext>((services, options) =>
{
    options.UseSqlite(builder.Configuration.GetConnectionString("Finance"));

    if (builder.Configuration.GetValue<bool>("Database:SeedDemoData"))
    {
        options.UseDemoData(services.GetRequiredService<TimeProvider>());
    }
});

builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>();

// Exchange rates: typed HttpClient with timeouts, retries and a circuit
// breaker; the service caches results and falls back to the last good rate.
builder.Services
    .AddHttpClient<IFrankfurterClient, FrankfurterClient>(client =>
    {
        client.BaseAddress = new Uri(builder.Configuration["Frankfurter:BaseUrl"] ?? "https://api.frankfurter.dev/v1/");
        client.DefaultRequestHeaders.UserAgent.ParseAdd("FinanceMonitor/1.0");
    })
    .AddStandardResilienceHandler(options =>
    {
        // Fail fast: the dashboard can always fall back to USD.
        options.AttemptTimeout.Timeout = TimeSpan.FromSeconds(3);
        options.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(8);
        options.CircuitBreaker.SamplingDuration = TimeSpan.FromSeconds(30);
    });
builder.Services.AddSingleton<IExchangeRateService, ExchangeRateService>();

var app = builder.Build();

app.UseForwardedHeaders();

// Unhandled exceptions and bare 4xx/5xx responses become RFC 9457 problem+json.
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseRateLimiter();

// Interactive API docs. Always on in development; in production only when
// Api:PublicDocs is set (the public demo turns it on). Served under /api so
// they're reachable through the frontend's /api rewrite.
if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("Api:PublicDocs"))
{
    app.MapOpenApi("/api/openapi/{documentName}.json");
    app.MapScalarApiReference("/api/docs", options => options
        .WithTitle("Finance Monitor API")
        .WithOpenApiRoutePattern("/api/openapi/{documentName}.json"));

    // Scalar redirects /api/docs to /api/docs/ so its relative script paths
    // resolve. Lambda function URLs drop the trailing slash, which turns that
    // into a redirect loop, so send people straight to the named document.
    app.MapGet("/api/docs", () => TypedResults.Redirect("/api/docs/v1")).ExcludeFromDescription();
}

app.MapHealthChecks("/health").DisableRateLimiting();
app.MapGroup("/api").MapEndpoints(typeof(Program).Assembly);

if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
}

await app.RunAsync();

/// <summary>Exposed so integration tests can boot the app with WebApplicationFactory.</summary>
public partial class Program;
