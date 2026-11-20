using System.Text.Json.Serialization;
using FinanceMonitoring.Api.Common.Endpoints;
using FinanceMonitoring.Api.Data;
using FinanceMonitoring.Api.Data.Seeding;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();

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

var app = builder.Build();

// Unhandled exceptions and bare 4xx/5xx responses become RFC 9457 problem+json.
app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();                // /openapi/v1.json
    app.MapScalarApiReference();     // /scalar — interactive API docs
}

app.MapHealthChecks("/health");
app.MapGroup("/api").MapEndpoints(typeof(Program).Assembly);

if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
}

await app.RunAsync();

/// <summary>Exposed so integration tests can boot the app with WebApplicationFactory.</summary>
public partial class Program;
