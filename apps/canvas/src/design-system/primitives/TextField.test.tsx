import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TextField } from "./TextField";

describe("TextField", () => {
  it("does not submit while an IME composition is active", () => {
    const onSubmitIntent = vi.fn();

    function Harness() {
      const [value, setValue] = useState("");
      return (
        <TextField
          label="Workspace name"
          value={value}
          onValueChange={setValue}
          onSubmitIntent={onSubmitIntent}
        />
      );
    }

    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "Workspace name" });

    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmitIntent).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input, { data: "合奏" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmitIntent).toHaveBeenCalledOnce();
  });
});
