/**
 * GeminiReportGenerator.js
 *
 * Script modular untuk membuat laporan AI menggunakan Gemini API berdasarkan data
 * dari tabel HTML dan input skenario dari pengguna.
 *
 * Diekstrak dari aplikasi SimMod (oleh Virda Nur Lu'lu) dan dijadikan
 * class yang dapat digunakan kembali.
 *
 * @version 1.0.0
 * @author Gemini (diadaptasi dari kode simmod-2.html)
 */

class GeminiReportGenerator {
	/**
	 * Menginisialisasi generator laporan.
	 * @param {object} config - Objek konfigurasi.
	 * @param {string} config.buttonId - ID dari elemen tombol untuk memicu laporan.
	 * @param {string} config.promptTextareaId - ID dari elemen textarea untuk input skenario.
	 * @param {string} config.responseContainerId - ID dari elemen div untuk menampilkan hasil laporan.
	 * @param {string} config.logTableId - ID dari elemen <table> yang berisi data log.
	 * @param {function} [config.getLanguage] - Fungsi opsional yang mengembalikan kode bahasa saat ini (misal 'en' atau 'id').
	 */
	constructor(config) {
		// Validasi konfigurasi dasar
		if (
			!config.buttonId ||
			!config.promptTextareaId ||
			!config.responseContainerId ||
			!config.logTableId
		) {
			console.error(
				"GeminiReportGenerator: Konfigurasi tidak lengkap. Harap sediakan semua ID elemen."
			);
			return;
		}

		this.config = config;

		// Referensi elemen DOM
		this.dom = {
			button: document.getElementById(config.buttonId),
			promptTextarea: document.getElementById(config.promptTextareaId),
			responseContainer: document.getElementById(config.responseContainerId),
			logTable: document.getElementById(config.logTableId),
		};

		// Pesan bilingual untuk error
		this.messages = {
			en: {
				provideScenario: "<p>Please provide a brief case study scenario.</p>",
				noLogData:
					"<p>Cannot generate a report without data in the Simulation Log.</p>",
				apiError: (msg) => `Error: ${msg}`,
				backendError:
					"The report generation service is currently unavailable. Please try again later.",
				httpError: (status, text) => `Service error! status: ${status} ${text}`,
				blockedRequest: (reason) =>
					`<p>Request was blocked due to safety settings. Reason: ${reason}. Please adjust your prompt.</p>`,
				apiResponseError: (msg) => `The AI service returned an error: ${msg}`,
				invalidResponse: "Invalid response structure from the AI service.",
			},
			id: {
				provideScenario: "<p>Mohon berikan skenario studi kasus singkat.</p>",
				noLogData:
					"<p>Tidak dapat membuat laporan tanpa data di dalam Log Simulasi.</p>",
				apiError: (msg) => `Galat: ${msg}`,
				backendError:
					"Layanan pembuatan laporan saat ini tidak tersedia. Silakan coba lagi nanti.",
				httpError: (status, text) => `Galat layanan! status: ${status} ${text}`,
				blockedRequest: (reason) =>
					`<p>Permintaan diblokir karena pengaturan keamanan. Alasan: ${reason}. Mohon sesuaikan prompt Anda.</p>`,
				apiResponseError: (msg) => `Layanan AI mengembalikan galat: ${msg}`,
				invalidResponse: "Struktur respons dari layanan AI tidak valid.",
			},
		};

		this.initialize();
	}

	/**
	 * Memeriksa elemen DOM dan melampirkan event listener.
	 */
	initialize() {
		// Periksa apakah semua elemen DOM ditemukan
		for (const key in this.dom) {
			if (!this.dom[key]) {
				console.error(
					`GeminiReportGenerator: Elemen dengan ID '${
						this.config[key + "Id"]
					}' tidak ditemukan.`
				);
				return;
			}
		}

		// Lampirkan event listener ke tombol
		this.dom.button.addEventListener("click", () =>
			this.handleGenerateReport()
		);
		console.log("GeminiReportGenerator berhasil diinisialisasi.");
	}

	/**
	 * Mengambil bahasa UI saat ini.
	 * @returns {string} 'en' atau 'id', default ke 'en'.
	 */
	_getUiLang() {
		if (
			this.config.getLanguage &&
			typeof this.config.getLanguage === "function"
		) {
			return this.config.getLanguage() || "en";
		}
		return "en";
	}

	/**
	 * Menampilkan pesan atau status loading di kontainer respons.
	 * @param {string} html - Konten HTML yang akan ditampilkan.
	 * @param {boolean} isLoading - Jika true, tampilkan status loading.
	 */
	_updateUIMessage(html, isLoading = false) {
		if (isLoading) {
			this.dom.responseContainer.innerHTML = "";
			this.dom.responseContainer.classList.add("loading"); // Pastikan Anda memiliki style CSS untuk .loading
		} else {
			this.dom.responseContainer.innerHTML = html;
			this.dom.responseContainer.classList.remove("loading");
		}
	}

	/**
	 * Membersihkan respons HTML dari API.
	 * @param {string} html - Teks HTML mentah dari Gemini.
	 * @returns {string} HTML yang sudah dibersihkan.
	 */
	_cleanApiResponse(html) {
		let cleanedHtml = (html || "").trim();

		// Hapus backticks (```) jika ada
		if (/^```/.test(cleanedHtml)) {
			const match = cleanedHtml.match(/^```([a-zA-Z0-9_-]+)?\n/);
			cleanedHtml = match
				? cleanedHtml.slice(match[0].length)
				: cleanedHtml.replace(/^```/, "");
			cleanedHtml = cleanedHtml.replace(/\n?```$/, "");
		}

		// Konversi entitas HTML jika responsnya lolos sebagai teks
		if (
			cleanedHtml.includes("&lt;") &&
			cleanedHtml.includes("&gt;") &&
			!cleanedHtml.includes("<div")
		) {
			const textarea = document.createElement("textarea");
			textarea.innerHTML = cleanedHtml;
			cleanedHtml = textarea.value;
		}

		return cleanedHtml;
	}

	/**
	 * PENTING: Fungsi ini mengekstrak data dari tabel log.
	 * Anda HARUS menyesuaikan fungsi ini agar sesuai dengan struktur <table> di HTML Anda.
	 * @returns {string} - Data log yang diformat sebagai teks.
	 */
	getLogDataAsText() {
		const table = this.dom.logTable;
		if (!table) return "Log table not found.";

		try {
			// Logika ini diambil dari simmod-2.html.
			// Sesuaikan querySelector di bawah ini jika struktur tabel Anda berbeda.
			const headers = Array.from(
				table.querySelectorAll("thead tr:first-child th")
			)
				.map((th) => th.textContent.trim())
				.slice(0, -1); // Menghapus kolom aksi
			const units = Array.from(
				table.querySelectorAll("thead tr.unit-row th")
			).map((th) => th.textContent.trim());

			const combinedHeaders = headers.map((h, i) =>
				units[i] ? `${h} ${units[i]}`.trim() : h
			);

			const rows = Array.from(table.querySelectorAll("tbody tr"));
			if (rows.length === 0) {
				return "No simulation log data available.";
			}

			// Hanya mengambil 1 baris terakhir untuk menghemat token
			const recentRows = rows.slice(-1);

			const data = recentRows.map((row) => {
				return Array.from(row.querySelectorAll("td"))
					.map((td) => td.textContent.trim())
					.slice(0, -1) // Menghapus kolom aksi
					.join(" | ");
			});

			return `Headers: ${combinedHeaders.join(" | ")}\nData (last ${
				recentRows.length
			} entry):\n${data.join("\n")}`;
		} catch (e) {
			console.error("Error parsing log table:", e);
			return "Error: Could not parse simulation log table. Check 'getLogDataAsText' function.";
		}
	}

	/**
	 * Menangani klik tombol "Generate Report".
	 */
	async handleGenerateReport() {
		const uiLang = this._getUiLang();
		const userScenario = this.dom.promptTextarea.value.trim();

		// Validasi input
		if (!userScenario) {
			this._updateUIMessage(this.messages[uiLang].provideScenario);
			return;
		}

		const logData = this.getLogDataAsText();
		if (
			logData.includes("No simulation log data available") ||
			logData.includes("Error:")
		) {
			this._updateUIMessage(this.messages[uiLang].noLogData);
			return;
		}

		// Tampilkan status loading dan nonaktifkan tombol
		this._updateUIMessage("", true);
		this.dom.button.disabled = true;

		try {
			// Panggil API backend
			const generatedHtml = await this._callBackendApi(userScenario, logData);
			const cleanHtml = this._cleanApiResponse(generatedHtml);

			// Tampilkan hasil
			this._updateUIMessage(cleanHtml);
		} catch (error) {
			console.error("Backend API call failed:", error);
			this._updateUIMessage(this.messages[uiLang].apiError(error.message));
		} finally {
			// Aktifkan kembali tombol
			this.dom.button.disabled = false;
			this.dom.responseContainer.classList.remove("loading");
		}
	}

	/**
	 * Memanggil API backend kustom.
	 * @param {string} prompt - Skenario studi kasus dari pengguna.
	 * @param {string} logData - Data log yang diformat.
	 * @returns {Promise<string>} - Teks respons yang dihasilkan oleh AI.
	 */
	async _callBackendApi(prompt, logData) {
		const uiLang = this._getUiLang();
		const apiUrl = "/api/generateReport"; // Endpoint backend

		try {
			const response = await fetch(apiUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt, logData }),
			});

			const result = await response.json();

			if (response.ok) {
				if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
					return result.candidates[0].content.parts[0].text; // Sukses
				} else {
					// Tangani respons yang valid tetapi diblokir atau error dari Gemini
					const blockReason = result.promptFeedback?.blockReason;
					if (blockReason)
						throw new Error(this.messages[uiLang].blockedRequest(blockReason));
					if (result.error)
						throw new Error(
							this.messages[uiLang].apiResponseError(result.error.message || JSON.stringify(result.error.details))
						);
					throw new Error(this.messages[uiLang].invalidResponse);
				}
			} else {
				// Tangani error dari backend itu sendiri
				const errorMessage = result.error || response.statusText;
				throw new Error(this.messages[uiLang].httpError(response.status, errorMessage));
			}
		} catch (error) {
			// Error jaringan atau error lainnya
			console.error(`Fetch failed for backend API:`, error);
			throw new Error(this.messages[uiLang].backendError);
		}
	}
}
