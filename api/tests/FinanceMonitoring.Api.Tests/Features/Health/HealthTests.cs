using System.Net;
using FinanceMonitoring.Api.Tests.Infrastructure;

namespace FinanceMonitoring.Api.Tests.Features.Health;

public sealed class HealthTests(FinanceApiFactory factory) : IClassFixture<FinanceApiFactory>
{
    [Fact]
    public async Task Reports_healthy_when_the_database_is_reachable()
    {
        var ct = TestContext.Current.CancellationToken;
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/health", UriKind.Relative), ct);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadAsStringAsync(ct)).Should().Be("Healthy");
    }
}
