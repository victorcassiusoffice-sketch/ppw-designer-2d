# City Build — local review guide

This build is saved locally on `gpt/designer-2026-10-13`. It has not been published. The following links run on Victor's computer while the preview server is running.

- [http://127.0.0.1:5173/designer?panel=city](http://127.0.0.1:5173/designer?panel=city) - Room Designer City Build: developers, civil contractors, utility planners and infrastructure suppliers; source-backed supplier references.
- [http://127.0.0.1:5173/demo?view=2d&panel=city&pitch=1](http://127.0.0.1:5173/demo?view=2d&panel=city&pitch=1) - Room Designer City Build: neutral, non-ordering demonstration for sales teams and prospective partners.

## A five-minute demonstration

1. Open City Build from the floor menu or City button. In an empty city, choose **Try an eco district**. The current detailed building is retained.
2. Switch between **2D** and **3D**. Zoom and pan, select an item, and open other sections. Use **Fit** only when you want to frame the whole site again.
3. Choose **Draw road** or **Draw utility**, tap the route corners and choose **Finish route**. In Details, enter the specified width, layer depths, diameter, trench dimensions and surveyed route elevations. Road templates are editable planning inputs, not approved standards.
4. Choose **Place equipment**, select an asset type and tap its position in the plan. Enter measured dimensions and any confirmed rating. Blank performance fields remain unconfirmed. The same measurements appear in both views.
5. Open **Infrastructure** to inspect supplier references for roads, solar, water, electrical distribution, data-centre systems and landscaping. **Link selected item** records a source; it does not automatically resize equipment or verify compatibility. **Prepare package** starts a draft with editable units and quantity.
6. Use **Data centre** to compare IT demand, facility overhead, solar generation, storage and optional water use. PUE includes facility overhead; solar is shown separately. Annual energy matching is not proof of uninterrupted power.
7. In **Orders**, add equipment and choose intended order, invoice and delivery dates, plus order and invoice recipient emails. Save the package, then inspect **Timeline**. A reviewed schedule is still a draft, not a sent order or issued invoice. Save or discard unfinished edits before leaving.
8. In **Overview**, check net road area, material volumes, utility lengths and unresolved assumptions. Resolve shared road-junction quantities before preparing multiple supplier packages. Costs require current quotations.
9. **Back to building** returns to the existing house tools. **Refresh building envelope** creates or updates a city snapshot of the current room bounds and storey height. Refresh again after changing the detailed building. Editing the city envelope does not reposition or resize the original house.

## What an employee can demonstrate honestly

One project can coordinate a measured district layout, building-design tools, infrastructure references, energy scenarios and dated equipment drafts. Contractors and suppliers can review the quantities and proposed dates together. Approved merchant accounts have a private draft-storage API; that new API still needs its database migration and deployed validation.

Do not promise live stock, confirmed prices, automatic purchasing, issued invoices, engineering certification or a complete city simulation. The city view uses measured planning envelopes, not manufacturer CAD. Existing building features remain available, but separate buildings do not yet each carry a linked detailed house model.

## Safe continuation

The source and tests are in `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`. The implementation workflow, research sources and procurement integration boundaries are saved beside this guide. Victor requested headless desktop/phone verification and an explicit Y before publication. Do not publish or apply the migration based on this guide alone.
