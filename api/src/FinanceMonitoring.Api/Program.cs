using System.Text.Json.Serialization;
using FinanceMonitoring.Api.Common.Endpoints;
using FinanceMonitoring.Api.Data;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.AddSingleton(TimeProvider.System);

// Enums travel as "Income"/"Expense" (not 0/1), in JSON and in the OpenAPI schema.
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Finance")));

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
