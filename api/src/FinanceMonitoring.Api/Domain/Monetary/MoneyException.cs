namespace FinanceMonitoring.Api.Domain.Monetary;

public enum MoneyErrorCode
{
    InvalidCurrency,
    CurrencyMismatch,
    OutOfRange,
    InvalidRate,
}

/// <summary>
/// Thrown for programmer errors such as mixing currencies. Mirrors the
/// frontend's <c>MoneyError</c> codes so both sides fail the same way.
/// </summary>
public sealed class MoneyException(MoneyErrorCode code, string message) : Exception(message)
{
    public MoneyErrorCode Code { get; } = code;
}
