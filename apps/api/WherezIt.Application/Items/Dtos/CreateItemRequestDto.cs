namespace WherezIt.Application.Items.Dtos;

public record CreateItemRequestDto(
    string Name,
    int Quantity = 1,
    string? Category = null
);
