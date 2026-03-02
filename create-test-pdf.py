from fpdf import FPDF

pdf = FPDF()
pdf.add_page()
pdf.set_font("Helvetica", "B", 16)
pdf.cell(0, 10, "CIMB Bank Credit Card Statement", ln=True, align="C")
pdf.set_font("Helvetica", "", 10)
pdf.cell(0, 8, "Statement Period: 01 Jan 2026 - 31 Jan 2026", ln=True, align="C")
pdf.cell(0, 8, "Card Number: XXXX-XXXX-XXXX-4567", ln=True, align="C")
pdf.cell(0, 8, "Account Holder: ABC Trading Sdn Bhd", ln=True, align="C")
pdf.ln(10)

# Table header
pdf.set_font("Helvetica", "B", 9)
pdf.cell(25, 8, "Date", border=1)
pdf.cell(80, 8, "Description", border=1)
pdf.cell(30, 8, "Category", border=1)
pdf.cell(25, 8, "Amount (RM)", border=1)
pdf.cell(25, 8, "Balance", border=1)
pdf.ln()

# Transactions
pdf.set_font("Helvetica", "", 9)
transactions = [
    ("02/01/2026", "PETRONAS STATION KL", "Fuel", "150.00", "150.00"),
    ("05/01/2026", "GRAB-EC PETALING JAYA MY", "Transport", "45.50", "195.50"),
    ("07/01/2026", "TESCO STORES SDN BHD", "Groceries", "234.80", "430.30"),
    ("10/01/2026", "TENAGA NASIONAL BHD", "Utilities", "385.00", "815.30"),
    ("12/01/2026", "DIGI TELECOMMUNICATIONS", "Telecom", "128.00", "943.30"),
    ("15/01/2026", "SHELL STATION PJ", "Fuel", "180.00", "1123.30"),
    ("18/01/2026", "FOODPANDA MALAYSIA", "Food", "67.90", "1191.20"),
    ("20/01/2026", "UNIFI TM NET", "Internet", "199.00", "1390.20"),
    ("22/01/2026", "PARKSON DEPT STORE", "Shopping", "450.00", "1840.20"),
    ("25/01/2026", "APPLE.COM/BILL", "Subscription", "49.90", "1890.10"),
]

for t in transactions:
    pdf.cell(25, 7, t[0], border=1)
    pdf.cell(80, 7, t[1], border=1)
    pdf.cell(30, 7, t[2], border=1)
    pdf.cell(25, 7, t[3], border=1, align="R")
    pdf.cell(25, 7, t[4], border=1, align="R")
    pdf.ln()

pdf.ln(5)
pdf.set_font("Helvetica", "B", 10)
pdf.cell(135, 8, "Total:", border=1)
pdf.cell(25, 8, "1,890.10", border=1, align="R")
pdf.cell(25, 8, "", border=1)

pdf.output("/home/ubuntu/bizbooks/test-statement.pdf")
print("PDF created: test-statement.pdf")
