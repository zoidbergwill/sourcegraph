# Cookbook for writing Sourcegraph extensions

## Provide hover

```typescript
// Imports the Sourcegraph extension API
import * as sourcegraph from "sourcegraph"

// Called by Sourcegraph when the extension is enabled by the user
export function activate(): void {
  // Shows a hello world message in a tooltip when the user hovers over code
  sourcegraph.languages.registerHoverProvider(["*"], {
    provideHover: () => ({ contents: { value: "Hello, world! 🎉🎉🎉" } })
  })
}
```

## Get the current document text

```typescript
import * as sourcegraph from "sourcegraph"

export function activate(): void {
  sourcegraph.languages.registerHoverProvider(["*"], {
    provideHover: doc => ({ contents: { value: "Document size: " + doc.text.length } })
  })
}
```

## Change line background colors

```typescript
import * as sourcegraph from "sourcegraph";

export function activate(): void {
  sourcegraph.workspace.onDidOpenTextDocument.subscribe(doc => {
    if (
      sourcegraph.app.activeWindow &&
      sourcegraph.app.activeWindow.visibleViewComponents.length > 0
    ) {
      sourcegraph.app.activeWindow.visibleViewComponents[0].setDecorations(
        null,
        [
          {
            // The top line (base 0)
            range: new sourcegraph.Range(
              new sourcegraph.Position(0, 0),
              new sourcegraph.Position(0, 0)
            ),
            backgroundColor: "magenta"
          }
        ]
      );
    }
  });
}
```

## Add an annotation after the end of a line

```typescript
import * as sourcegraph from "sourcegraph";

export function activate(): void {
  sourcegraph.workspace.onDidOpenTextDocument.subscribe(doc => {
    if (
      sourcegraph.app.activeWindow &&
      sourcegraph.app.activeWindow.visibleViewComponents.length > 0
    ) {
      sourcegraph.app.activeWindow.visibleViewComponents[0].setDecorations(
        null,
        [
          {
            range: new sourcegraph.Range(
              new sourcegraph.Position(0, 0),
              new sourcegraph.Position(0, 0)
            ),
            after: {
              contentText: " View on npm (" + downloads + " DLs last week)",
              linkURL: `https://www.npmjs.com/package/${pkg}`,
              backgroundColor: "pink",
              color: "black"
            }
          }
        ]
      );
    }
  });
}
```

**Read/write settings**

```typescript
import * as sourcegraph from "sourcegraph";

export function activate(): void {
  function afterActivate() {
    const address = sourcegraph.configuration.get().get("graphql.langserver-address");
    if (!address) {
      console.log("No graphql.langserver-address was set, exiting.");
      return;
    }
    // ...
  }

  // Error creating extension host: Error: Configuration is not yet available.
  // `sourcegraph.configuration.get` is not usable until after the extension
  // `activate` function is finished executing. This is a known issue and will
  // be fixed before the beta release of Sourcegraph extensions. In the
  // meantime, work around this limitation by deferring calls to `get`.
  setTimeout(afterActivate, 0);
}
```
