type SignupHoneypotProps = {
  company: string
  setCompany: (value: string) => void
}

/** Off-screen field. People never see it. Bots that fill every input do. */
export function SignupHoneypot({ company, setCompany }: SignupHoneypotProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '-10000px',
        top: 'auto',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
    >
      <label>
        Company
        <input
          tabIndex={-1}
          autoComplete="off"
          value={company}
          name="company"
          onChange={(event) => setCompany(event.target.value)}
        />
      </label>
    </div>
  )
}
