@AGENTS.md
## Design Skills
When doing any frontend design, styling, or UI work on this project, always consult and apply guidance from the installed skills in .claude/skills/, including:
- Impeccable
- Taste Skill (if installed)

Use these skills' principles for spacing, typography, color, and overall visual polish before writing UI code.

## React Hooks

Never depend on a whole context object in a useEffect or useCallback
dependency array. Depend on the specific primitive fields you use. Context
providers construct new value objects on render, so depending on the
object tears the effect down on every incidental re-render - this silently
stranded the guided tour mid-flight and produced no error.