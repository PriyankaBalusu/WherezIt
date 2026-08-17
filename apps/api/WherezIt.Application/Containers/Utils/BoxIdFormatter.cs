namespace WherezIt.Application.Containers.Utils;

public static class BoxIdFormatter
{
    public static string Format(int boxNumber)
    {
        return $"BOX {boxNumber:D3}";
    }
}
