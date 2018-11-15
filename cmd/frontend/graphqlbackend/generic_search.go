package graphqlbackend

import (
	"context"
	"fmt"
	"strings"
)

// A resolver for the GraphQL type GenericSearchMatch
type GenericSearchMatchResolver struct {
	url             string
	body            string
	path            *string
	language        string
	highlights      []*highlightedRange
	highlightedBody *string
}

func (m *GenericSearchMatchResolver) URL() string {
	return m.url
}

func (m *GenericSearchMatchResolver) Body(ctx context.Context) string {
	return m.body
}

func (m *GenericSearchMatchResolver) Highlights(ctx context.Context) []*highlightedRange {
	return m.highlights
}

func (m *GenericSearchMatchResolver) HighlightedBody(ctx context.Context) (*string, error) {
	return m.highlightedBody, nil
	// if m.path == nil {
	// 	return nil, nil
	// }
	// var (
	// 	html   template.HTML
	// 	result = &highlightedFileResolver{}
	// )
	// // Check if the body should be highlighted.
	// var err error
	// html, result.aborted, err = highlight.Code(ctx, m.body, *m.path, false, true)
	// if err != nil {
	// 	return nil, err
	// }
	// if result.aborted {
	// 	return &m.body, nil
	// }
	// result.html = string(html)

	// return &result.html, nil
}

func GetHighlightedWithContext(ctx context.Context, file *gitTreeEntryResolver, lineNumber int32) string {
	q := struct {
		DisableTimeout bool
		IsLightTheme   bool
	}{
		true,
		true,
	}

	fmt.Println("COMMIT", file.path, file.commit)
	if file.commit.oid != "" {
		h, err := file.Highlight(ctx, &q)
		if err != nil {
			return ""
		}
		highlightedHTML := h.html
		withoutInitialTable := highlightedHTML[len("<table>"):]
		noTable := withoutInitialTable[:len(withoutInitialTable)-len("</table>")]
		n := strings.Split(noTable, "</tr>")
		linesWithContext := n[lineNumber-2 : lineNumber+1]
		for index, row := range linesWithContext {
			linesWithContext[index] = row + "</tr>"
		}
		return strings.Join(linesWithContext, "")
	}
	return ""

}
