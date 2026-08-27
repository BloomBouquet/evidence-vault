import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("uses native button semantics and defaults to type button", () => {
    render(<Button>저장</Button>);
    const button = screen.getByRole("button", { name: "저장" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("ev-button", "ev-button--primary", "ev-button--md");
  });

  it("applies requested variant and size while preserving custom classes", () => {
    render(<Button variant="danger" size="sm" className="extra-class">삭제</Button>);
    expect(screen.getByRole("button", { name: "삭제" })).toHaveClass(
      "ev-button--danger",
      "ev-button--sm",
      "extra-class",
    );
  });

  it("disables the native control while busy", () => {
    render(<Button busy>내보내기 생성</Button>);
    const button = screen.getByRole("button", { name: "내보내기 생성" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("respects an explicitly disabled control", () => {
    render(<Button disabled>저장</Button>);
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });
});
