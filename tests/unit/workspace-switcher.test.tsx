import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => "/dashboard/calendar",
}));

// El switcher importa el Server Action, que arrastra @/db y lanza sin DATABASE_URL.
vi.mock("@/features/workspaces/actions", () => ({
  setActiveWorkspace: vi.fn(async () => ({ success: true, data: undefined })),
}));

const { WorkspaceSwitcher } = await import(
  "@/features/workspaces/components/workspace-switcher"
);

const WORKSPACES = [
  { id: "ws-1", name: "Grupo Cálculo", color: "#6366f1", role: "admin" },
];

describe("WorkspaceSwitcher", () => {
  it("abre el menú sin lanzar (el label necesita un Menu.Group alrededor)", () => {
    render(<WorkspaceSwitcher workspaces={WORKSPACES} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Cambiar espacio de trabajo" })
    );

    const items = screen.getAllByRole("menuitem").map((el) => el.textContent);
    expect(items).toEqual(["Personal", "Grupo Cálculo", "Gestionar espacios"]);
  });

  it("marca el espacio activo que recibe por prop", () => {
    render(
      <WorkspaceSwitcher workspaces={WORKSPACES} activeWorkspaceId="ws-1" />
    );

    expect(
      screen.getByRole("button", { name: "Cambiar espacio de trabajo" })
    ).toHaveTextContent("Grupo Cálculo");
  });
});
