using Microsoft.AspNetCore.Http.HttpResults;

namespace FinanceMonitoring.Api.Features.Transactions;

internal static class Conflict
{
    /// <summary>409 problem details for a stale <c>version</c>.</summary>
    public static ProblemHttpResult Problem(long? currentVersion) =>
        TypedResults.Problem(
            statusCode: StatusCodes.Status409Conflict,
            title: "This transaction was changed by someone else.",
            detail: "Reload it to see the latest version, then try again.",
            extensions: currentVersion is { } version
                ? new Dictionary<string, object?> { ["currentVersion"] = version }
                : null);
}
