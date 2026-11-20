using System.Net;
using System.Net.Http.Json;
using FinanceMonitoring.Api.Tests.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;

namespace FinanceMonitoring.Api.Tests.Hosting;

public sealed class RateLimitingTests
{
    [Fact]
    public async Task Allows_requests_up_to_the_limit_then_returns_429_with_retry_after()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var baseFactory = new FinanceApiFactory();
        using var factory = baseFactory.WithWebHostBuilder(b => b.UseSetting("RateLimiting:PermitsPerMinute", "3"));
        using var client = factory.CreateClient();
        var url = new Uri("/api/categories", UriKind.Relative);

        for (var i = 0; i < 3; i++)
        {
            using var ok = await client.GetAsync(url, ct);
            ok.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        using var limited = await client.GetAsync(url, ct);

        limited.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        limited.Headers.RetryAfter!.ToString().Should().Be("60");
        var problem = await limited.Content.ReadFromJsonAsync<ProblemDetails>(TestJson.Options, ct);
        problem!.Title.Should().Be("Too many requests. Try again in a minute.");
    }

    [Fact]
    public async Task Never_rate_limits_the_health_check()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var baseFactory = new FinanceApiFactory();
        using var factory = baseFactory.WithWebHostBuilder(b => b.UseSetting("RateLimiting:PermitsPerMinute", "1"));
        using var client = factory.CreateClient();

        for (var i = 0; i < 5; i++)
        {
            using var response = await client.GetAsync(new Uri("/health", UriKind.Relative), ct);
            response.StatusCode.Should().Be(HttpStatusCode.OK);
        }
    }
}

public sealed class ApiDocsTests
{
    [Fact]
    public async Task Are_off_outside_development_by_default()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var factory = new FinanceApiFactory(); // "Testing" environment
        using var client = factory.CreateClient();

        using var docs = await client.GetAsync(new Uri("/api/openapi/v1.json", UriKind.Relative), ct);

        docs.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Can_be_published_with_a_setting()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var baseFactory = new FinanceApiFactory();
        using var factory = baseFactory.WithWebHostBuilder(b => b.UseSetting("Api:PublicDocs", "true"));
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        using var document = await client.GetAsync(new Uri("/api/openapi/v1.json", UriKind.Relative), ct);
        using var ui = await client.GetAsync(new Uri("/api/docs/v1", UriKind.Relative), ct);

        document.StatusCode.Should().Be(HttpStatusCode.OK);
        (await document.Content.ReadAsStringAsync(ct)).Should().Contain("\"/api/transactions\"");
        ui.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ui.Content.ReadAsStringAsync(ct)).Should().Contain("api/openapi/v1.json");
    }

    [Fact]
    public async Task Entry_point_redirects_to_the_document_without_relying_on_a_trailing_slash()
    {
        // Lambda function URLs strip trailing slashes, so Scalar's own
        // "/api/docs" -> "docs/" redirect would loop there.
        var ct = TestContext.Current.CancellationToken;
        await using var baseFactory = new FinanceApiFactory();
        using var factory = baseFactory.WithWebHostBuilder(b => b.UseSetting("Api:PublicDocs", "true"));
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        using var entry = await client.GetAsync(new Uri("/api/docs", UriKind.Relative), ct);

        entry.StatusCode.Should().Be(HttpStatusCode.Redirect);
        entry.Headers.Location.Should().Be(new Uri("/api/docs/v1", UriKind.Relative));
    }
}
