/* Column layout matches Acumatica's "Purchase Orders Template" import sheet exactly
   (same headers, same order, same static defaults) so this file can be dropped
   straight into Acumatica without reshaping. */
const ACUMATICA_PO_SHEET_NAME = "Purchase Orders Template";

const ACUMATICA_HEADERS = [
  "Branch", "Inventory ID", "Sub.", "Account", "Description", "Line Description",
  "UOM", "Order Qty.", "Unit Cost", "Ext. Cost", "Amount", "Qty. On Receipts",
  "Discount Percent", "Line Type", "Warehouse", "Discount Amount", "Manual Discount",
  "Discount Code", "Prepaid Qty.", "Prepaid Amount", "Alternate ID", "Min. Receipt (%)",
  "Max. Receipt (%)", "Receipt Action", "Complete On (%)", "Tax Category",
  "Accrual Account", "Accrual Sub.", "Requested", "Promised", "Completed", "Cancelled",
  "Closed", "Billed Qty.", "Billed Amount", "Unbilled Qty.", "Unbilled Amount",
  "Blanket PO Type", "Blanket PO Nbr.", "Billing Based On",
];

function buildAcumaticaLine(disb, line, refDateISO) {
  const iso = refDateISO || todayISO();
  const refDate = new Date(iso + "T00:00:00");
  const amount = Number(line.amount) || 0;
  return {
    "Branch": disb.branchCode,
    "Inventory ID": "",
    "Sub.": line.department,
    "Account": accountForCategory(line.category),
    "Description": line.category,
    /* Expense description + department description only — no code number. */
    "Line Description": `${(line.expense && line.expense.trim()) ? line.expense.trim() : line.category} — ${deptDesc(line.department)}`,
    "UOM": "PC",
    "Order Qty.": 1,
    "Unit Cost": amount,
    "Ext. Cost": amount,
    "Amount": amount,
    "Qty. On Receipts": 0,
    "Discount Percent": 0,
    "Line Type": "Service",
    "Warehouse": "",
    "Discount Amount": 0,
    "Manual Discount": "True",
    "Discount Code": "",
    "Prepaid Qty.": 0,
    "Prepaid Amount": 0,
    "Alternate ID": "",
    "Min. Receipt (%)": 0,
    "Max. Receipt (%)": 100,
    "Receipt Action": "Accept but Warn",
    "Complete On (%)": 100,
    "Tax Category": line.taxCategory || "",
    "Accrual Account": "",
    "Accrual Sub.": "",
    "Requested": refDate,
    "Promised": refDate,
    "Completed": "False",
    "Cancelled": "False",
    "Closed": "False",
    "Billed Qty.": 0,
    "Billed Amount": 0,
    "Unbilled Qty.": 1,
    "Unbilled Amount": amount,
    "Blanket PO Type": "",
    "Blanket PO Nbr.": "",
    "Billing Based On": "Order",
  };
}

function buildLiquidationExportRows(disb, liq) {
  const refDateISO = (liq && liq.createdDate) || todayISO();
  return (liq ? liq.lines : []).map((line) => buildAcumaticaLine(disb, line, refDateISO));
}

/* Every voucher that currently has liquidation lines, flattened into one sheet —
   used by "Export All to Acumatica" in the Liquidation tab. */
function buildAllAcumaticaExportRows(disbursements, liquidations) {
  const rows = [];
  disbursements.forEach((disb) => {
    const liq = liquidationFor(disb.id, liquidations);
    if (!liq || !liq.lines || !liq.lines.length) return;
    liq.lines.forEach((line) => rows.push(buildAcumaticaLine(disb, line, liq.createdDate)));
  });
  return rows;
}
