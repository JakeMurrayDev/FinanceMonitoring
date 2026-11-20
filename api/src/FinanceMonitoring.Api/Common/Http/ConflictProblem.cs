using Microsoft.AspNetCore.Http.HttpResults;

namespace FinanceMonitoring.Api.Common.Http;

internal static class ConflictProblem
{
    /// <summary>409 problem details for a stale <c>version</c> (optimistic concurrency).</summary>
    /// <param name="thing">What was changed, e.g. "transaction" or "budget".</param>
    /// <param name="currentVersion">The version now stored, if known.</param>
    public static ProblemHttpResult For(string thing, long? currentVersion) =>
        TypedResults.Problem(
            statusCode: StatusCodes.Status409Conflict,
            title: $"This {thing} was changed by someone else.",
            detail: "Reload it to see the latest version, then try again.",
            extensions: currentVersion is { } version
                ? new Dictionary<string, object?> { ["currentVersion"] = version }
                : null);
}
