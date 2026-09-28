import { LIMITS } from "@/lib/validation";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  ref?: React.Ref<HTMLInputElement>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

/** A one-time-code input: digits only, sized for the code, and offered for autofill from SMS/email by the OS. */
export default function CodeInput({ onChange, ...props }: InputProps) {
  return (
    <input
      {...props}
      className="otp-input"
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={LIMITS.otpLength}
      placeholder={"•".repeat(LIMITS.otpLength)}
      onChange={(e) => {
        e.target.value = e.target.value.replace(/\D/g, "").slice(0, LIMITS.otpLength);
        onChange(e);
      }}
    />
  );
}
