namespace FinanceMonitoring.Api.Common.Endpoints;

/// <summary>
/// REPR (Request–Endpoint–Response): every HTTP operation is one class that
/// maps exactly one route. Its request and response types sit next to it, so
/// everything about an operation lives in a single file.
/// </summary>
/// <remarks>
/// Implementations are discovered by <see cref="EndpointRouteBuilderExtensions.MapEndpoints"/>;
/// adding a feature never means editing Program.cs.
/// </remarks>
public interface IEndpoint
{
    void Map(IEndpointRouteBuilder app);
}
