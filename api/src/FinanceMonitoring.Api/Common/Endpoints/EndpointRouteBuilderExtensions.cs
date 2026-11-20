using System.Reflection;

namespace FinanceMonitoring.Api.Common.Endpoints;

public static class EndpointRouteBuilderExtensions
{
    /// <summary>Finds every <see cref="IEndpoint"/> in the assembly and maps it.</summary>
    public static IEndpointRouteBuilder MapEndpoints(this IEndpointRouteBuilder app, Assembly assembly)
    {
        var endpointTypes = assembly.DefinedTypes
            .Where(type => type is { IsAbstract: false, IsInterface: false }
                           && type.IsAssignableTo(typeof(IEndpoint)))
            .OrderBy(type => type.FullName, StringComparer.Ordinal);

        foreach (var type in endpointTypes)
        {
            var endpoint = (IEndpoint)Activator.CreateInstance(type)!;
            endpoint.Map(app);
        }

        return app;
    }
}
