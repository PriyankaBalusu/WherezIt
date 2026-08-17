namespace WherezIt.Application.Items.Dtos;

public record UpdateItemRequestDto(
    string? Name,
    int? Quantity
);
