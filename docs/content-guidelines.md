# Content guidelines

- Start from a concrete question or decision. Introduce actors and trust
  boundaries before protocol parameters. Use the Reading List example
  where it helps continuity.
- Explain what the protocol specifies and identify application choices such
  as sign-in UX, session storage, or the shape of resource permissions.
- Cite the relevant section of a specification for security requirements.
  Read current security guidance and errata alongside the base protocol.
  For OAuth, use [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html)
  alongside the relevant grant and extension documents.
- Reserve “must” for requirements and use the appropriate scope. Identify
  which actor performs each check and when it applies.
- Label historical material. The resource owner password credentials grant
  must not be used. RFC 9700 advises against the implicit grant and other
  authorization responses that issue access tokens directly.
- Distinguish code, access token, ID token, refresh token, and session.
  Separate a token's purpose, representation, validation, and revocation.
- Use fictional names and reserved `.example` hosts. Use stable fixture
  values exclusively. Exercise bytes and keys must be generated for this site.
- Use meaningful headings, text equivalents for diagrams, and HTTP excerpts
  readers can inspect without animation. All initial SVG diagrams and
  icons are original project artwork under the repository license.

Lesson IDs come from MDX filenames and form public URLs. Define a title,
description, curriculum track, a unique positive learning order, and at
least one section-specific source. Add a simulation ID only when it
directly supports the lesson. Check the rendered page at a narrow width
and with JavaScript disabled.
