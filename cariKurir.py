import gspread
from google.oauth2.service_account import Credentials

def getPaketKurir(nama_dicari=""):
    scope = ["https://www.googleapis.com/auth/spreadsheets"]
    credentials = Credentials.from_service_account_file("credentials.json", scopes=scope)
    gc = gspread.authorize(credentials)
    worksheet = gc.open_by_key("1Cp8LvSNgVZtiU7GybnFr02RfYyuAfOziHhVm7yHxqL4").worksheet("Monitoring")

    header_cells = worksheet.range("CB5:CD5")
    header_map = {cell.value.strip(): cell.col for cell in header_cells}
    kurir_col = worksheet.col_values(79)[9:]  # Baris 10 ke bawah

    hasil_akhir = ""
    nama_dicari = nama_dicari.strip().lower()

    if nama_dicari:
        ditemukan = False
        for i, nama in enumerate(kurir_col):
            if nama_dicari in nama.lower():
                ditemukan = True
                baris_kurir = i + 10
                hasil = f"📦 *{nama}*\n"
                for status in ["POD", "POS", "Belum POD/POS"]:
                    col = header_map.get(status)
                    if col:
                        nilai = worksheet.cell(baris_kurir, col).value
                        hasil += f"- {status}: {nilai or '0'}\n"
                hasil_akhir += hasil + "\n"

        if not ditemukan:
            return f"❌ Kurir dengan kata *{nama_dicari}* tidak ditemukan Njir."
        return hasil_akhir.strip()

    else:
        # Kalau tidak ada nama dicari, tampilkan semua
        semua_data = ""
        for i, nama in enumerate(kurir_col):
            baris = i + 10
            hasil = f"📦 *{nama}*\n"
            for status in ["POD", "POS", "Belum POD/POS"]:
                col = header_map.get(status)
                if col:
                    nilai = worksheet.cell(baris, col).value
                    hasil += f"- {status}: {nilai or '0'}\n"
            semua_data += hasil + "\n"
        return semua_data.strip()

# Agar bisa dipanggil dari Node.js
if __name__ == "__main__":
    import sys
    args = sys.argv[1:]
    nama = " ".join(args).strip() if args else ""
    print(getPaketKurir(nama))
