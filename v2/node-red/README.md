# Node-RED flow (v2)

The v2 flow hasn't been exported yet. To add it:

1. Open Node-RED from the Home Assistant sidebar.
2. Open the water flow's tab, then select all its nodes (Ctrl+A).
3. Open Menu → Export. Choose **Selected nodes** and **JSON**, then **Download**.
4. Save the file here as `flows.json`. A screenshot saved as `flow_chart.png`
   helps too.

Before you commit, search the JSON for passwords, tokens and phone numbers. The
WhatsApp/Green API node in particular may hold an API key. Replace each one
with a placeholder.
