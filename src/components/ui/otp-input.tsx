"use client";

import {
  forwardRef,
  useContext,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from "react";
import { OTPInput, OTPInputContext } from "input-otp";

/**
 * A small wrapper around input-otp.
 *
 * input-otp is headless: it owns focus, paste and keyboard handling and leaves
 * the markup to the caller. These three pieces are the markup the site needs —
 * a group, six slots and a caret — styled by the `.otp-*` rules in
 * src/styles/components/otp.css rather than by utility classes.
 */
export const InputOTP = forwardRef<
  ElementRef<typeof OTPInput>,
  ComponentPropsWithoutRef<typeof OTPInput>
>(({ containerClassName = "", className = "", ...props }, ref) => (
  <OTPInput
    ref={ref}
    containerClassName={`otp ${containerClassName}`.trim()}
    className={`otp-field ${className}`.trim()}
    {...props}
  />
));
InputOTP.displayName = "InputOTP";

export function InputOTPGroup({ children }: { children: ReactNode }) {
  return <div className="otp-group">{children}</div>;
}

export function InputOTPSlot({ index }: { index: number }) {
  const context = useContext(OTPInputContext);
  const slot = context.slots[index];

  return (
    <div className={`otp-slot${slot.isActive ? " is-active" : ""}`}>
      {slot.char}
      {slot.hasFakeCaret ? <span className="otp-caret" aria-hidden="true" /> : null}
    </div>
  );
}
