using System;
using System.Text.RegularExpressions;

namespace WherezIt.Infrastructure.Logging;

public static class LogSanitizer
{
    private static readonly Regex SecretPattern = new Regex(
        @"(authorization|bearer|token|password|secret|key|signedurl|gcsurl)=([^\s&]+)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static string Sanitize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;

        return SecretPattern.Replace(input, "$1=[REDACTED]");
    }
}
