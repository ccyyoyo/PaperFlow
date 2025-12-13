# Feature: Note Taking

```gherkin
Scenario: Create note from selection
  Given a PDF is open
  When text is selected
  Then a note is saved with the anchor

Scenario: Align sidebar to current PDF page
  Given the sidebar is in free scroll mode
  And the user scrolls the sidebar away from the current page
  When the user clicks "Align" (follow mode)
  Then the sidebar jumps to the cards of the current PDF page
  And the sidebar starts following the PDF page

Scenario: Browse other cards without being pulled back
  Given the sidebar is in follow mode
  When the user switches to free scroll mode
  Then the sidebar scroll position is independent from the PDF page
```

> TODO: Add more scenarios.
