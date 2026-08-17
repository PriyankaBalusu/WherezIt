namespace WherezIt.Domain.Entities;

public class WorkspaceBoxCounter
{
    public Guid WorkspaceId { get; set; }
    public int NextBoxNumber { get; set; } = 1;

    public Workspace Workspace { get; set; } = null!;
}
