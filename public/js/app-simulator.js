// public/js/app-simulator.js
let simulationLog = []; // Make simulationLog globally accessible for better module interaction
let lastApiResults = null; // <-- TAMBAHKAN BARIS INI
let updatePsVsZeChart = () => {}; // Define a placeholder function in a shared scope
let isSliderVisible = false; // Lacak status visibilitas slider
let currentLanguage = "en"; // Default language
let xyPlotController; // <-- TAMBAHKAN INI
// ---> START: TAMBAHKAN BLOK INI <---
const citations = {
	1: "Wang et al., 2023",
	2: "Clancey, 1972; Crowl & Louvar, 2011",
	3: "Clancey, 1972; CCPS, 2000",
	4: "Jeremić & Bajić., 2006",
};

/**
 * Mengganti [n] dalam teks dengan sitasi penuh dari objek 'citations'.
 * @param {string} text Teks yang mungkin berisi [n].
 * @returns {string} Teks dengan [n] diganti sitasi, atau teks asli jika tidak ada sitasi.
 */
function replaceCitations(text) {
	if (!text) return ""; // Handle null/undefined input
	// Cari semua [digit] dan ganti
	return text.replace(/\[(\d+)\]/g, (match, numberStr) => {
		const citationText = citations[numberStr];
		// Jika sitasi ditemukan, format dengan tag <cite>
		// Jika tidak, kembalikan teks asli [n]
		return citationText ? ` (<cite>${citationText}</cite>)` : match;
	});
}
let translations = {};

const translateKey = (key, fallbackKey = "unknown") => {
	const lang = translations[currentLanguage] || translations["en"];
	const englishTranslations = translations["en"];

	if (!key) {
		// Ensure englishTranslations is checked before accessing fallbackKey
		const fallbackText =
			lang[fallbackKey] ||
			(englishTranslations && englishTranslations[fallbackKey]) ||
			fallbackKey;
		// console.log(`Translate Fallback: "${fallbackKey}" -> "${fallbackText}"`);
		return fallbackText;
	}

	const currentLangText = lang[key];
	// Ensure englishTranslations is checked before accessing key
	const englishText = englishTranslations
		? englishTranslations[key]
		: undefined;
	let result = key; // Default to key itself if not found anywhere

	if (currentLangText !== undefined) {
		result = currentLangText;
	} else if (englishText !== undefined) {
		result = englishText;
	}

	// console.log(`Translate Key: "${key}", Lang: ${currentLanguage}, Result: "${result}"`);
	return result;
};

// Global utility functions
function debounce(func, delay = 250) {
	let timeoutId;
	return function (...args) {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => {
			func.apply(this, args);
		}, delay);
	};
}

const fields = ["rho", "vol", "dh", "eta", "e_tnt", "dist", "pa"];
const inputFields = ["material", ...fields];
const $ = (id) => document.getElementById(id);
function saveFormStateToLocalStorage() {
	try {
		const currentState = {};
		inputFields.forEach((id) => {
			const el = $(id);
			if (el && el.value !== undefined) {
				currentState[id] = el.value;
			}
		});
		localStorage.setItem("explosionSimState", JSON.stringify(currentState));
	} catch (error) {
		console.warn("Could not save form state to localStorage:", error);
	}
}

function parseNumberLoose(s) {
	if (s == null) return NaN;
	s = String(s)
		.trim()
		.replace(/\s+/g, "")
		.replace(/\u00A0/g, "");
	if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s))
		s = s.replace(/\./g, "").replace(",", ".");
	else if (/^\d+,\d+$/.test(s)) s = s.replace(",", ".");
	else s = s.replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, "");
	return Number(s);
}

function extractNumbers(line) {
	const toks = String(line).match(/-?\d+(?:[.,]\d+)?/g) || [];
	return toks.map(parseNumberLoose).filter((n) => Number.isFinite(n));
}

function parseData(text) {
	const out = [];
	const rows = (text || "")
		.split(/[\r\n]+/)
		.map((r) => r.trim())
		.filter(Boolean);
	for (const r of rows) {
		const nums = extractNumbers(r);
		if (!nums.length) continue;
		const rVal = nums[0];
		const poVal = nums.length > 1 ? nums[1] : null;
		if (rVal > 0)
			out.push({
				r: rVal,
				Po: poVal != null && Number.isFinite(poVal) ? poVal : null,
			});
	}
	out.sort((a, b) => a.r - b.r);
	return out;
}

document.addEventListener("DOMContentLoaded", () => {
	let isPageLoaded = false; // Flag to prevent premature execution
	const presets = {
		AN: { rho: 1725, dh: 2479, e_tnt: 4686, eta: 0.66 },
		LPG: { rho: 492, dh: 46011, e_tnt: 4686, eta: 0.02 },
		H2: { rho: 0.08375, dh: 130800, e_tnt: 4686, eta: 0.05 },
	};
	const eqMap = {
		AN: [
			{
				labelKey: "eq_label_detonation",
				eq: '2 NH<sub>4</sub>NO<sub>3</sub>(s) <span class="arrow">→</span> 2 N<sub>2</sub>(g) + O<sub>2</sub>(g) + 4 H<sub>2</sub>O(g)',
			},
		],
		LPG: [
			{
				labelKey: "eq_label_combustion_propane",
				eq: 'C<sub>3</sub>H<sub>8</sub>(g) + 5 O<sub>2</sub>(g) <span class="arrow">→</span> 3 CO<sub>2</sub>(g) + 4 H<sub>2</sub>O(g)',
			},
		],
		H2: [
			{
				labelKey: "eq_label_combustion_explosion",
				eq: '2 H<sub>2</sub>(g) + O<sub>2</sub>(g) <span class="arrow">→</span> 2 H<sub>2</sub>O(g)',
			},
		],
	};
	const materialAbbreviationMap = {
		"Ammonium Nitrate (AN)": "AN",
		"Propane (LPG)": "LPG",
		"Hydrogen (H₂)": "H₂",
		"Amonium Nitrat (AN)": "AN",
		"Propana (LPG)": "LPG",
		"Hidrogen (H₂)": "H₂",
	};
	// --- START: Code to load the menu ---
	const menuPlaceholder = document.getElementById("menu-placeholder");
	if (menuPlaceholder) {
		fetch("/html/_menu.html") // Make sure the path is correct relative to your HTML file
			.then((response) => {
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				return response.text();
			})
			.then((html) => {
				menuPlaceholder.innerHTML = html;
				// **IMPORTANT:** Re-attach event listeners after loading the menu
				setupMenuToggle(); // Call a function to set up the menu click behavior
			})
			.catch((error) => {
				console.error("Error loading menu:", error);
				menuPlaceholder.innerHTML =
					'<p style="color:red; text-align:center;">Error loading menu.</p>';
			});
	} else {
		console.log("Menu placeholder not found!"); // <-- Cek ini jika placeholder tidak ada
	}

	// Function to set up the dropdown toggle behavior
	function setupMenuToggle() {
		const dropdown = document.querySelector(".dropdown-menu"); // Find the newly added menu
		if (dropdown) {
			const dropdownToggle = dropdown.querySelector(".dropdown-toggle");
			if (dropdownToggle) {
				dropdownToggle.addEventListener("click", (event) => {
					event.stopPropagation();
					dropdown.classList.toggle("is-active");
				});
			}
			// Close menu when clicking outside
			document.addEventListener("click", (event) => {
				if (
					dropdown.classList.contains("is-active") &&
					!dropdown.contains(event.target)
				) {
					dropdown.classList.remove("is-active");
				}
			});
		}
	}

	/*===================================================
      | START: BILINGUAL TRANSLATION SCRIPT                 
      ====================================================*/

	const footerPlaceholder = document.getElementById("footer-placeholder");

	if (footerPlaceholder) {
		fetch("/html/_footer.html") // Pastikan path ini benar
			.then((response) => {
				if (!response.ok) {
					console.error(`Gagal memuat footer: Status ${response.status}`);
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				return response.text();
			})
			.then((html) => {
				footerPlaceholder.innerHTML = html;

				// **PENTING:** Terapkan terjemahan ke footer yang baru dimuat
				// Panggil kembali fungsi yang menerapkan terjemahan ke elemen baru
				// (Asumsi: fungsi setLanguage atau fungsi terjemahan internal Anda
				// dapat dipanggil ulang untuk menargetkan elemen baru)
				if (typeof setLanguage === "function") {
					// Panggil ulang dengan bahasa saat ini untuk menerjemahkan footer
					setLanguage(currentLanguage);
				} else {
					console.warn(
						"setLanguage function not found globally, cannot translate loaded footer."
					);
				}
			})
			.catch((error) => {
				console.error("Error loading footer:", error);
				footerPlaceholder.innerHTML =
					'<p style="color:red; text-align:center;">Error loading footer.</p>';
			});
	} else {
		console.log("Footer placeholder not found!"); // Log untuk debug
	}
	// --- END: Kode untuk memuat footer ---

	async function loadTranslationsAndInit() {
		try {
			// 1. Ambil kedua file JSON secara paralel
			const [enResponse, idResponse] = await Promise.all([
				fetch("/lang/en.json"), // Sesuaikan path jika perlu
				fetch("/lang/id.json"), // Sesuaikan path jika perlu
			]);

			if (!enResponse.ok || !idResponse.ok) {
				throw new Error("Gagal memuat file terjemahan.");
			}

			// 2. Ubah respons menjadi JSON
			const enData = await enResponse.json();
			const idData = await idResponse.json();

			// 3. Isi variabel 'translations' global
			translations = {
				en: enData,
				id: idData,
			};

			// 4. Pindahkan SEMUA kode inisialisasi ke SINI
			// Ini memastikan sisa skrip hanya berjalan SETELAH
			// file terjemahan berhasil dimuat.
			// ---> TAMBAHKAN BLOK SUPABASE DI SINI <---
			try {
				// Ganti dengan URL dan Kunci Anon Proyek Supabase Anda
				const SUPABASE_URL = "https://pjnbshyobrpkkbkoxnqk.supabase.co";
				const SUPABASE_ANON_KEY =
					"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqbmJzaHlvYnJwa2tia294bnFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NTQ0OTYsImV4cCI6MjA3NzIzMDQ5Nn0.xtbLpO3SOPEYMVaeCXzig5GFX4ghVUFlwt3DmePdY5E";
				const supabaseClient = supabase.createClient(
					SUPABASE_URL,
					SUPABASE_ANON_KEY
				);

				let { data: scenarioRows, error } = await supabaseClient
					.from("scenarios") // Nama tabel Anda
					.select("id, name, data_points"); // Kolom yang Anda buat

				if (error) {
					throw new Error("Gagal mengambil skenario: " + error.message);
				}

				// Ubah data (array) dari Supabase menjadi format (objek)
				// yang diharapkan oleh aplikasi Anda.
				scenarioRows.forEach((row) => {
					simulationScenarios[row.id] = {
						name: row.name,
						data: row.data_points, // Perhatikan: data_points -> data
					};
				});
			} catch (dbError) {
				console.error("Error Supabase:", dbError);
				// Tampilkan error ke pengguna agar mereka tahu datanya gagal dimuat
				showStatusMessage(
					"Gagal memuat skenario dari database.",
					true,
					dbError.message
				);
				// Anda bisa memutuskan apakah akan menghentikan aplikasi atau lanjut
				// tanpa data skenario
			}
			// ---> AKHIR BLOK SUPABASE <---
			// --- MULAI BLOK YANG DIPINDAHKAN ---
			initLanguage();
			loadLogo();
			toTopBtn.addEventListener("click", goTop);
			populateSimulationSelector();
			setupSliderArrows();
			initializeSimulationState(); // <-- Satu baris ini menggantikan pemanggilan loadLog() dan render...() yang lama
			loadStateFromURL();
			setupCollapsePanel();
			updatePsVsZeChart(); // Initial plot

			isInitializing = false;

			// ========================================================== -->
			// GANTI BLOK INTERAKSI LAMA DENGAN YANG BARU INI
			// ========================================================== -->
			// Hentikan slideshow jika pengguna berinteraksi dengan slider APAPUN
			document.querySelectorAll(".slider-nav").forEach((nav) => {
				nav.addEventListener("click", stopSlideshow);
			});
			document.querySelectorAll(".slider").forEach((slider) => {
				slider.addEventListener("pointerdown", stopSlideshow);
			});
			// ========================================================== -->

			setTimeout(() => {
				isPageLoaded = true;
				handlePanelVisibility();
			}, 250);
			// --- AKHIR BLOK YANG DIPINDAHKAN ---

			// Initialize AI Report Generator
			const geminiConfig = {
				buttonId: "generate-report-button",
				promptTextareaId: "gemini-prompt",
				responseContainerId: "gemini-response",
				logTableId: "logTable",
				getLanguage: () => currentLanguage,
			};
			new GeminiReportGenerator(geminiConfig);
		} catch (error) {
			console.error("Error memuat terjemahan:", error);
			// Tampilkan pesan error ke pengguna
			document.body.innerHTML =
				'<h1 style="color: red; text-align: center; padding-top: 50px;">Error: Gagal memuat data aplikasi. Silakan coba muat ulang halaman.</h1>';
		}
	}
	// ---> AKHIR FUNGSI TAMBAHAN <---

	function setLanguage(lang) {
		if (!translations[lang]) return;
		currentLanguage = lang;
		try {
			localStorage.setItem("preferredLanguage", lang);
		} catch (e) {
			console.warn("Could not save language preference to local storage:", e);
		}

		document.documentElement.lang = lang;
		// Menerjemahkan semua elemen dengan data-lang-key (Ini aman untuk semua halaman)
		document.querySelectorAll("[data-lang-key]").forEach((el) => {
			const key = el.getAttribute("data-lang-key");
			// Gunakan translateKey global yang sudah ada
			const translation = translateKey(key, key); // Fallback ke key jika tidak ditemukan
			if (translation !== undefined) {
				if (
					el.placeholder !== undefined &&
					(el.tagName === "INPUT" || el.tagName === "TEXTAREA")
				) {
					el.placeholder = translation;
				} else {
					// Gunakan innerHTML agar tag <strong> dll. di dalam terjemahan berfungsi
					el.innerHTML = translation;
				}
			}
		});

		// Update status tombol bahasa (Ini aman untuk semua halaman)
		document.querySelectorAll(".lang-btn").forEach((btn) => {
			btn.classList.toggle("active", btn.dataset.lang === lang);
		});

		// --- AWAL BLOK KHUSUS SIMULASI (Tambahkan Cek) ---
		const materialSelect = $("material"); // Cek sekali saja
		if (materialSelect) {
			if (materialSelect.value) {
				renderEquation(materialSelect.value);
			}
			// Update panel hanya jika kita di halaman simulasi (panel ada)
			if ($("panel-damage-crowl")) {
				// Cek keberadaan salah satu panel
				if (lastApiResults) {
					updateEstimationPanels(
						lastApiResults.Po_crowl,
						lastApiResults.Po_alonso,
						lastApiResults.Po_sadovski,
						lastApiResults.isAlonsoExtrapolated,
						lastApiResults.assessments
					);
					updateInjuryPanels(
						lastApiResults.Po_crowl,
						lastApiResults.Po_alonso,
						lastApiResults.Po_sadovski,
						lastApiResults.isAlonsoExtrapolated,
						lastApiResults.assessments
					);
				} else {
					updateEstimationPanels(NaN, NaN, NaN, false, null);
					updateInjuryPanels(NaN, NaN, NaN, false, null);
				}
			}
		}
		// --- AKHIR BLOK KHUSUS SIMULASI ---

		// --- AWAL BLOK CHART (Tambahkan Cek) ---
		// Asumsi chartController & overpressureChartController adalah global atau di window
		if (
			typeof chartController !== "undefined" &&
			chartController &&
			typeof updatePsVsZeChart === "function"
		) {
			updatePsVsZeChart();
		}
		if (
			typeof overpressureChartController !== "undefined" &&
			overpressureChartController &&
			typeof updateOverpressureChartFromLog === "function"
		) {
			updateOverpressureChartFromLog();
		}
		// --- AKHIR BLOK CHART ---

		// --- AWAL BLOK PANEL MELAYANG (Tambahkan Cek) ---
		if ($("floatPanelInputs")) {
			// Cek jika elemen panel melayang ada
			setupFloatingPanel(); // Setup ulang untuk terjemahan label
			// Update output panel melayang jika ada hasil terakhir
			if (lastApiResults) {
				updateFloatingPanelOutputs(
					lastApiResults.Po_crowl,
					lastApiResults.Po_alonso,
					lastApiResults.Po_sadovski,
					true
				);
			} else {
				updateFloatingPanelOutputs(NaN, NaN, NaN, false);
			}
		}
		// --- AKHIR BLOK PANEL MELAYANG ---

		// --- Update Teks Tombol Slider (Aman, sudah ada cek di dalam fungsi updateToggleButtonVisibility) ---
		const selector = $("simulationSelector");
		if (selector) {
			updateToggleButtonVisibility(selector.value); // Update visibilitas tombol show/hide slider
		}
		// Juga update teks tombol jika sudah terlihat
		const btnToggleSlider = $("btnToggleSlider");
		if (btnToggleSlider && btnToggleSlider.style.display !== "none") {
			const currentKey = btnToggleSlider.getAttribute("data-lang-key");
			if (currentKey) {
				btnToggleSlider.textContent = translateKey(
					currentKey,
					"btn_toggle_slider"
				);
			}
		}
	} // Akhir fungsi setLanguage
	function initLanguage() {
		let preferredLanguage = "en";
		try {
			preferredLanguage = localStorage.getItem("preferredLanguage") || "en";
		} catch (e) {
			console.warn("Could not read language preference from local storage:", e);
		}
		setLanguage(preferredLanguage);
		document.querySelectorAll(".lang-btn").forEach((btn) => {
			btn.addEventListener("click", () => {
				setLanguage(btn.dataset.lang);
			});
		});
	}
	/*
      ========================================================
      | END: BILINGUAL TRANSLATION SCRIPT                    |
      =======================================================*/

	// GANTI DENGAN BLOK DI BAWAH INI
	let simulationScenarios = {};

	// ====== START: DYNAMIC SLIDESHOW SCRIPT BLOCK ======
	// Variabel global untuk menyimpan ID interval slideshow
	let slideshowInterval = null;

	// Fungsi untuk menghentikan slideshow yang sedang berjalan
	function stopSlideshow() {
		if (slideshowInterval) {
			clearInterval(slideshowInterval);
			slideshowInterval = null;
		}
	}

	// Fungsi untuk memulai slideshow untuk slider tertentu
	function startSlideshow(activeSliderContainer) {
		stopSlideshow(); // Selalu hentikan slideshow sebelumnya
		if (!activeSliderContainer) return;

		const slider = activeSliderContainer.querySelector(".slider");
		if (!slider) return;

		const totalSlides = slider.querySelectorAll(".slide-item").length;
		if (totalSlides <= 1) return; // Jangan jalankan slideshow jika hanya ada satu gambar

		slideshowInterval = setInterval(() => {
			const slideWidth = slider.clientWidth;
			let nextSlideIndex = Math.round(slider.scrollLeft / slideWidth) + 1;

			if (nextSlideIndex >= totalSlides) {
				nextSlideIndex = 0; // Kembali ke awal
			}

			slider.scrollTo({
				left: nextSlideIndex * slideWidth,
				behavior: "smooth",
			});
		}, 1500); // Interval 1.5 detik
	}

	// Fungsi utama untuk mengontrol visibilitas semua slider
	function updateSliderVisibility() {
		const selector = document.getElementById("simulationSelector");
		if (!selector) return;

		const sliderMap = {
			gangneung: document.getElementById("gangneungSliderContainer"),
			beirut: document.getElementById("beirutSliderContainer"),
			tianjin: document.getElementById("tianjinSliderContainer"),
			wenling: document.getElementById("wenlingSliderContainer"),
			sanJuanico: document.getElementById("sanjuanicoSliderContainer"),
			experiment: document.getElementById("experimentSliderContainer"),
		};

		// --- AWAL PERBAIKAN ---

		// 1. Sembunyikan semua slider terlebih dahulu
		Object.values(sliderMap).forEach((slider) => {
			if (slider) slider.style.display = "none";
		});

		// 2. Dapatkan slider yang aktif
		const selectedValue = selector.value;
		let activeSlider = null;
		if (sliderMap[selectedValue]) {
			activeSlider = sliderMap[selectedValue];
		}

		// 3. Hentikan slideshow apa pun yang sedang berjalan
		stopSlideshow();

		// 4. Periksa apakah slider harus terlihat
		// Jika tombol "Real Event" AKTIF (isSliderVisible = true) DAN ada slider yang valid,
		// maka tampilkan slider itu dan mulai slideshow-nya.
		if (isSliderVisible && activeSlider) {
			activeSlider.style.display = "block";
			startSlideshow(activeSlider);
		}

		// Jika tombol "Real Event" TIDAK AKTIF (isSliderVisible = false),
		// atau jika tidak ada slider yang valid,
		// maka fungsi ini hanya akan menyembunyikan semuanya (sudah dilakukan di langkah 1).

		// --- AKHIR PERBAIKAN ---
	}
	function updateToggleButtonVisibility(selectedValue) {
		const btnToggleSlider = $("btnToggleSlider");
		if (!btnToggleSlider) return;

		// Peta ini HANYA berisi skenario yang MEMILIKI slider di index.html
		const sliderMap = {
			gangneung: true,
			beirut: true,
			tianjin: true,
			wenling: true,
			sanJuanico: true,
			experiment: true,
		};

		if (sliderMap[selectedValue]) {
			btnToggleSlider.style.display = ""; // Tampilkan tombol (kembali ke default)
		} else {
			btnToggleSlider.style.display = "none"; // Sembunyikan tombol

			// Jika tombol disembunyikan, pastikan slider juga ikut tersembunyi
			if (isSliderVisible) {
				isSliderVisible = false;
				updateSliderVisibility(); // Ini akan menyembunyikan slider yang mungkin sedang terbuka

				// Reset teks tombol kembali ke "Real Event"
				const newKey = "btn_toggle_slider";
				btnToggleSlider.setAttribute("data-lang-key", newKey);
				btnToggleSlider.textContent = translateKey(newKey, "btn_toggle_slider");
			}
		}
	}
	// ====== START: SLIDER ARROW NAVIGATION SCRIPT ======
	function setupSliderArrows() {
		// Cari semua slider wrapper di halaman
		document.querySelectorAll(".slider-wrapper").forEach((wrapper) => {
			const slider = wrapper.querySelector(".slider");
			const prevButton = wrapper.querySelector(".slider-arrow.prev");
			const nextButton = wrapper.querySelector(".slider-arrow.next");

			// Lewati jika salah satu elemen tidak ditemukan
			if (!slider || !prevButton || !nextButton) return;

			// Tambahkan event listener untuk tombol "Next"
			nextButton.addEventListener("click", () => {
				const slideWidth = slider.clientWidth;
				// Geser ke kanan sejauh lebar satu slide
				slider.scrollBy({ left: slideWidth, behavior: "smooth" });
				stopSlideshow(); // Hentikan slideshow otomatis saat panah diklik
			});

			// Tambahkan event listener untuk tombol "Previous"
			prevButton.addEventListener("click", () => {
				const slideWidth = slider.clientWidth;
				// Geser ke kiri sejauh lebar satu slide
				slider.scrollBy({ left: -slideWidth, behavior: "smooth" });
				stopSlideshow(); // Hentikan slideshow otomatis saat panah diklik
			});
		});
	}
	// ====== END: SLIDER ARROW NAVIGATION SCRIPT ======

	let chartController;
	let overpressureChartController;
	// simulationLog is now globally defined, so we remove the local 'let' declaration here.
	function showStatusMessage(messageKey, isError = false, extraInfo = "") {
		const msgEl = $("msg");
		if (!msgEl) return;
		const message =
			(translations[currentLanguage][messageKey] || messageKey) + extraInfo;
		msgEl.textContent = message;
		if (isError) {
			msgEl.classList.add("bad");
		} else {
			msgEl.classList.remove("bad");
		}
		msgEl.style.display = "block";
		setTimeout(() => {
			if (msgEl.textContent === message) {
				msgEl.style.display = "none";
			}
		}, 5000);
	}

	function loadLogo() {
		const img = $("itbLogo");
		if (!img) return;
		const fallback =
			'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><circle cx="128" cy="128" r="120" fill="%230079c2"/><text x="50%" y="56%" font-family="Georgia, serif" font-size="88" text-anchor="middle" fill="white">ITB</text></svg>';
		img.onerror = () => {
			img.onerror = null;
			img.src = fallback;
		};
		img.src = "/img/Logo_Institut_Teknologi_Bandung.webp";
	}

	function goTop() {
		try {
			window.scrollTo({ top: 0, behavior: "smooth" });
		} catch (e) {
			window.scrollTo(0, 0);
		}
	}
	function initializeChart() {
		const chartDom = document.getElementById("chart");
		if (!chartDom) return null;
		const chart = echarts.init(chartDom);
		new ResizeObserver(() => chart.resize()).observe(chartDom);
		const css = getComputedStyle(document.documentElement);
		const BLUE = (css.getPropertyValue("--blue-itb") || "#0079c2").trim();
		const DANGER = (css.getPropertyValue("--danger") || "#DC2626").trim();
		const fPs = (ze) =>
			(1616 * (1 + (ze / 4.5) ** 2)) /
			(Math.sqrt(1 + (ze / 0.048) ** 2) *
				Math.sqrt(1 + (ze / 0.32) ** 2) *
				Math.sqrt(1 + (ze / 1.35) ** 2));
		const logspace = (min, max, n = 1000) =>
			Array.from(
				{ length: n },
				(_, i) =>
					10 **
					(Math.log10(min) +
						((Math.log10(max) - Math.log10(min)) * i) / (n - 1))
			);
		const refPairs = logspace(0.01, 100).map((z) => [z, fPs(z)]);
		const btn = $("btnExport");
		if (btn) {
			btn.addEventListener("click", () => {
				const url = chart.getDataURL({
					type: "png",
					pixelRatio: 2,
					backgroundColor: "#FFFFFF",
				});
				const a = document.createElement("a");
				a.href = url;
				a.download = "plot-explosion-ps-vs-ze.png";
				a.click();
			});
		}

		const getBaseOption = () => ({
			backgroundColor: "transparent",
			tooltip: {
				confine: true,
				trigger: "item",
				formatter: (p) => {
					const v = Array.isArray(p.value) ? p.value : [];
					const zeV = Number.isFinite(v[0]) ? v[0].toPrecision(4) : "—";
					const psV = Number.isFinite(v[1]) ? v[1].toPrecision(4) : "—";
					return `<b>${p.seriesName}</b><br/>ze: ${zeV}<br/>Ps: ${psV}`;
				},
				backgroundColor: "#FFFFFF",
				borderColor: "#cccccc",
				borderWidth: 1,
				textStyle: { color: "#212121" },
			},
			xAxis: {
				type: "log",
				logBase: 10,
				min: 0.01,
				max: 100,
				axisLine: { lineStyle: { color: "#94a3b8" } },
				splitLine: { lineStyle: { color: "rgba(0, 0, 0, 0.1)", width: 2 } },
				minorSplitLine: {
					show: true,
					lineStyle: { color: "rgba(0, 0, 0, 0.05)" },
				},
			},
			yAxis: {
				type: "log",
				logBase: 10,
				min: 0.01,
				max: 10000,
				nameRotate: 90,
				axisLine: { lineStyle: { color: "#94a3b8" } },
				splitLine: { lineStyle: { color: "rgba(0, 0, 0, 0.1)", width: 2 } },
				minorSplitLine: {
					show: true,
					lineStyle: { color: "rgba(0, 0, 0, 0.05)" },
				},
			},
			series: [
				// Pre-define series structure
				{
					name: translations[currentLanguage].chart_tooltip_ref_curve,
					type: "line",
					showSymbol: false,
					lineStyle: {
						width: 2.5,
						color: BLUE,
						shadowColor: "rgba(0, 0, 0, 0.2)",
						shadowBlur: 5,
						shadowOffsetY: 2,
					},
					data: refPairs,
					zlevel: 1,
				},
				{
					name: "Log Data",
					type: "scatter",
					symbolSize: 8,
					itemStyle: {
						color: "#64748b",
						borderColor: "#ffffff",
						borderWidth: 1,
						opacity: 0.7,
					},
					data: [],
					zlevel: 2,
				},
				{
					name: "Current Calculation",
					type: "scatter",
					symbolSize: 12,
					itemStyle: {
						color: DANGER,
						borderColor: "#ffffff",
						borderWidth: 2,
						shadowColor: "rgba(0,0,0,0.3)",
						shadowBlur: 5,
					},
					data: [],
					zlevel: 3,

					// ==================================================
					// --- AWAL PERUBAHAN: Tambahkan blok 'label' ini ---
					// ==================================================
					label: {
						show: true, // Membuat label selalu terbuka
						position: "left",
						// position: function (params) {
						//   const zeValue = params.value[0];
						//   // Jika nilai ze > 30, pindah ke kiri agar tidak terpotong
						//   if (Number.isFinite(zeValue) && zeValue > 30) {
						//     return 'left';
						//   }
						//   // Jika tidak, tetap di kanan
						//   return 'right';
						// }, // Posisi label di sebelah kanan titik
						backgroundColor: "rgba(255, 255, 255, 0.9)", // Latar belakang putih transparan
						borderColor: "#999",
						borderWidth: 1,
						borderRadius: 4,
						padding: [4, 6],
						color: "#212121", // Warna teks
						fontSize: 10,
						fontWeight: "bold",
						formatter: (p) => {
							// p.value adalah array [ze, ps]
							const v = Array.isArray(p.value) ? p.value : [];
							const zeV = Number.isFinite(v[0]) ? v[0].toPrecision(4) : "—";
							const psV = Number.isFinite(v[1]) ? v[1].toPrecision(4) : "—";
							// Format dalam satu baris
							return `ze: ${zeV}, Ps: ${psV}`;
						},
					},
					// ==================================================
					// --- AKHIR PERUBAHAN ---
					// ==================================================
				},
			],
			media: [
				{
					query: { minWidth: 601 },
					option: {
						grid: { left: 72, right: 35, top: 80, bottom: 70 },
						title: {
							text: translations[currentLanguage].chart_title_main,
							subtext: translations[currentLanguage].chart_subtitle_main,
							left: "center",
							top: 10,
							textStyle: { color: "#212121", fontSize: 20 },
							subtextStyle: { color: "#424242" },
						},
						xAxis: {
							name: translations[currentLanguage].chart_x_axis_label,
							nameLocation: "middle",
							nameGap: 35,
							nameTextStyle: {
								color: "#212121",
								fontSize: 16,
								fontWeight: "bold",
							},
							axisLabel: { color: "#424242" },
						},
						yAxis: {
							name: translations[currentLanguage].chart_y_axis_label,
							nameLocation: "middle",
							nameGap: 50,
							nameTextStyle: {
								color: "#212121",
								fontSize: 16,
								fontWeight: "bold",
							},
							axisLabel: { color: "#424242" },
						},
					},
				},
				{
					query: { maxWidth: 600 },
					option: {
						grid: { left: 55, right: 20, top: 70, bottom: 60 },
						title: {
							text: translations[currentLanguage].chart_title_mobile,
							subtext: translations[currentLanguage].chart_subtitle_mobile,
							left: "center",
							top: 10,
							textStyle: { color: "#212121", fontSize: 16 },
							subtextStyle: { color: "#424242", fontSize: 12 },
						},
						xAxis: {
							name: translations[currentLanguage].chart_x_axis_label_mobile,
							nameLocation: "middle",
							nameGap: 30,
							nameTextStyle: {
								color: "#212121",
								fontSize: 14,
								fontWeight: "bold",
							},
							axisLabel: { color: "#424242", fontSize: 10 },
						},
						yAxis: {
							name: translations[currentLanguage].chart_y_axis_label_mobile,
							nameLocation: "middle",
							nameGap: 35,
							nameTextStyle: {
								color: "#212121",
								fontSize: 14,
								fontWeight: "bold",
							},
							axisLabel: { color: "#424242", fontSize: 10 },
						},
					},
				},
			],
		});

		// chart.setOption(getBaseOption());
		return {
			updateChart: function (currentCalcPoint, logDataPoints) {
				chart.setOption(getBaseOption());
				const materialSel = $("material");
				const selectedOption = materialSel
					? materialSel.options[materialSel.selectedIndex]
					: null;
				const compoundName =
					selectedOption && selectedOption.value
						? selectedOption.text
						: "Calculation";
				const currentSeriesData =
					currentCalcPoint &&
					Number.isFinite(currentCalcPoint.ze) &&
					Number.isFinite(currentCalcPoint.ps)
						? [[currentCalcPoint.ze, currentCalcPoint.ps]]
						: [];
				chart.setOption({
					series: [
						{
							name: translations[currentLanguage].chart_tooltip_ref_curve,
							data: refPairs,
						},
						{ name: "Log Data", data: logDataPoints || [] },
						{
							name: `${translations[currentLanguage].chart_tooltip_compound}: ${compoundName}`,
							data: currentSeriesData,
						},
					],
				});
			},
		};
	}

	// Overwrite the placeholder with the actual function implementation
	updatePsVsZeChart = function () {
		if (!chartController) return;
		const pa = parseFloat($("pa").value);
		if (isNaN(pa)) return;
		// 1. Dapatkan Data Log - SELALU gunakan 'po_crowl' untuk konsistensi.
		const logPoints = simulationLog
			.map((log) => {
				const ze = parseFloat(log.ze);
				const po = parseFloat(log.po_crowl); // Revisi: Dikunci ke model Crowl
				if (!isNaN(ze) && !isNaN(po)) {
					const ps = po / pa;
					return [ze, ps];
				}
				return null;
			})
			.filter(Boolean);
		// 2. Dapatkan Data Perhitungan Saat Ini - SELALU gunakan 'Po_crowl'.
		const currentZe = parseFloat($("Ze")?.value);
		let currentPs;
		if (!isNaN(currentZe) && pa > 0) {
			const currentPoCrowl = parseFloat($("Po_crowl")?.value); // Revisi: Hanya menggunakan Crowl
			if (!isNaN(currentPoCrowl)) {
				currentPs = currentPoCrowl / pa;
			}
		}
		const currentCalcPoint = { ze: currentZe, ps: currentPs };
		// 3. Perbarui grafik
		chartController.updateChart(currentCalcPoint, logPoints);
	};

	function initializeOverpressureChart() {
		const ctx = document.getElementById("overpressureChart");
		if (!ctx) return null;
		const chart = new Chart(ctx, {
			type: "line",
			data: {
				datasets: [
					{
						label: "Crowl",
						data: [],
						borderColor: "rgb(255, 99, 132)",
						borderWidth: 2.5,
						tension: 0.4,
						pointRadius: 3,
						pointHoverRadius: 5,
					},
					{
						label: "Alonso",
						data: [],
						borderColor: "rgb(54, 162, 235)",
						borderWidth: 2.5,
						tension: 0.4,
						pointRadius: 3,
						pointHoverRadius: 5,
					},
					{
						label: "Sadovski",
						data: [],
						borderColor: "rgb(75, 192, 192)",
						borderWidth: 2.5,
						tension: 0.4,
						pointRadius: 3,
						pointHoverRadius: 5,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: {
						display: true,
						text: "Overpressure vs Distance",
						font: { size: 20, weight: "bold" },
						padding: { top: 10, bottom: 20 },
					},
					legend: {
						display: true,
						position: "top",
						labels: { usePointStyle: true, pointStyle: "line" },
					},
				},
				scales: {
					x: {
						type: "linear",
						title: {
							display: true,
							text: "Distance [m]",
							font: { size: 14, weight: "500" },
						},
						grid: { drawOnChartArea: true, color: "rgba(0, 0, 0, 0.05)" },
					},
					y: {
						title: {
							display: true,
							text: "Overpressure [kPa]",
							font: { size: 14, weight: "500" },
						},
						grid: { drawOnChartArea: true, color: "rgba(0, 0, 0, 0.05)" },
					},
				},
			},
		});

		return {
			chartInstance: chart,
		};
	}

	function updateOverpressureChartFromLog() {
		if (
			!overpressureChartController ||
			!overpressureChartController.chartInstance
		)
			return;
		const chart = overpressureChartController.chartInstance;
		const msgEl = $("overpressureChartMsg");
		const canvasEl = $("overpressureChart");
		chart.options.plugins.title.text =
			translations[currentLanguage].chart_title_po_vs_dist;
		chart.options.scales.x.title.text =
			translations[currentLanguage].overpressure_chart_x_axis_label;
		chart.options.scales.y.title.text =
			translations[currentLanguage].overpressure_chart_y_axis_label;
		canvasEl.style.display = "block";
		msgEl.style.display = "none";

		if (simulationLog.length === 0) {
			chart.data.datasets.forEach((dataset) => {
				dataset.data = [];
			});
			chart.options.scales.x.min = 0;
			chart.options.scales.x.max = 3000;
			chart.options.scales.y.min = 0;
			chart.options.scales.y.max = 100;
			chart.update();
			return;
		}

		const crowlPoints = [];
		const alonsoPoints = [];
		const sadovskiPoints = [];
		const allYValues = [];
		const allXValues = [];
		simulationLog.forEach((log) => {
			const dist = parseFloat(log.dist);
			if (isNaN(dist)) return;
			allXValues.push(dist);
			const poCrowl = parseFloat(log.po_crowl);
			if (!isNaN(poCrowl)) {
				crowlPoints.push({ x: dist, y: poCrowl });
				allYValues.push(poCrowl);
			}

			const poAlonso = parseFloat(log.po_alonso);
			if (!isNaN(poAlonso)) {
				alonsoPoints.push({ x: dist, y: poAlonso });
				allYValues.push(poAlonso);
			}

			const poSadovski = parseFloat(log.po_sadovski);
			if (!isNaN(poSadovski)) {
				sadovskiPoints.push({ x: dist, y: poSadovski });
				allYValues.push(poSadovski);
			}
		});

		const sortByX = (a, b) => a.x - b.x;
		chart.data.datasets[0].data = crowlPoints.sort(sortByX);
		chart.data.datasets[1].data = alonsoPoints.sort(sortByX);
		chart.data.datasets[2].data = sadovskiPoints.sort(sortByX);
		if (allYValues.length > 0) {
			const minX = Math.min(...allXValues);
			const maxX = Math.max(...allXValues);
			const minY = Math.min(...allYValues);
			const maxY = Math.max(...allYValues);
			chart.options.scales.x.min = minX > 0 ? minX * 0.95 : 0;
			chart.options.scales.x.max = maxX * 1.05;
			chart.options.scales.y.min = minY > 0 ? minY * 0.95 : 0;
			chart.options.scales.y.max = maxY * 1.05;
		} else {
			chart.options.scales.x.min = 0;
			chart.options.scales.x.max = 3000;
			chart.options.scales.y.min = 0;
			chart.options.scales.y.max = 100;
		}

		chart.update();
	}

	// FUNGSI BARU: Untuk menyorot baris pertama dari tabel log
	function highlightFirstRow() {
		const logTbody = $("logTbody");
		if (!logTbody) return;
		// Hapus sorotan yang sudah ada dari baris lain
		const currentlySelected = logTbody.querySelector(".selected-row");
		if (currentlySelected) {
			currentlySelected.classList.remove("selected-row");
		}
		// Tambahkan kelas sorotan ke baris data pertama di tabel
		const firstRow = logTbody.querySelector("tr:not(.log-placeholder)");
		if (firstRow) {
			firstRow.classList.add("selected-row");
		}
	}

	function updateEstimationPanels(
		PoCrowl,
		PoAlonso,
		PoSadovski,
		isAlonsoExtrapolated = false,
		assessmentDataFromArgs
	) {
		// --- Logika Pengambilan Data Asesmen ---
		let assessmentData = null;
		if (assessmentDataFromArgs !== undefined) {
			// Jika data diberikan (dari calculateValues), gunakan itu
			assessmentData = assessmentDataFromArgs;
			// console.log("updateEstimationPanels: Using data from arguments.");
		} else if (lastApiResults && lastApiResults.assessments) {
			// Jika tidak ada data argumen (dari setLanguage), gunakan global
			assessmentData = lastApiResults.assessments;
			// console.log("updateEstimationPanels: Using data from global lastApiResults.");
		} else {
			// console.log("updateEstimationPanels: No assessment data available.");
		}
		// 'assessmentData' sekarang berisi data yang benar atau null

		const methods = { crowl: PoCrowl, alonso: PoAlonso, sadovski: PoSadovski };

		Object.entries(methods).forEach(([method, Po]) => {
			const isPoValid = Number.isFinite(Po);
			// Ambil data asesmen spesifik untuk metode ini (bisa null)
			const assessment =
				assessmentData && assessmentData[method]
					? assessmentData[method]
					: null;

			// --- Referensi Elemen HTML (PENTING ADA SEMUA) ---
			const valPoEl = $(`val-Po-${method}`);
			const sevEl = $(`sev-${method}`);
			const structuralListEl = $(`structural-damage-${method}`);
			const equipmentListEl = $(`equipment-damage-${method}`);

			// Lewati jika elemen tidak ditemukan
			if (!valPoEl || !sevEl || !structuralListEl || !equipmentListEl) {
				console.error(`Missing elements for damage panel: ${method}`);
				return;
			}

			// --- Tentukan Kunci Kategori ---
			// --- PERBAIKAN 2: Ubah fallback 'unknown' menjadi 'awaiting_input' ---
			const impactCategoryNameKey =
				isPoValid && assessment && assessment.impactCategoryNameKey
					? assessment.impactCategoryNameKey
					: "awaiting_input"; // <-- GANTI DARI 'unknown'

			// console.log(`Damage Panel (${method}) - Final Key: "${impactCategoryNameKey}"`);

			// --- Update Tampilan ---
			// Nilai Overpressure (Po)
			valPoEl.textContent = isPoValid
				? Po.toLocaleString(undefined, {
						minimumFractionDigits: 3,
						maximumFractionDigits: 3,
				  })
				: "—";

			// Label Severity (Teks & Warna)
			sevEl.textContent = translateKey(impactCategoryNameKey); // Gunakan translateKey global
			if (isPoValid && assessment) {
				sevEl.style.backgroundColor = assessment.impactColor || "var(--muted)";
				sevEl.style.color = assessment.impactTextColor || "#FFFFFF";
			} else {
				// Gaya default jika tidak valid
				sevEl.style.backgroundColor = "var(--muted)";
				sevEl.style.color = "#FFFFFF";
			}

			// Detail Kerusakan (Struktural & Equipment)
			if (!isPoValid || !assessment) {
				structuralListEl.innerHTML = `<li>${translateKey(
					"awaiting_input"
				)}</li>`;
				equipmentListEl.innerHTML = `<li>${translateKey(
					"awaiting_input"
				)}</li>`;
			} else {
				// --- AWAL PERUBAHAN ---
				// Bangun HTML Struktural (apply replaceCitations)
				let structuralHtml = (assessment.structuralKeys || [])
					.map(
						(key) => `<li>${replaceCitations(translateKey(key))}</li>` // <--- Terapkan di sini
					)
					.join("");
				if (assessment.structuralRangeDescKey) {
					// Terapkan juga pada deskripsi rentang
					structuralHtml += `<li>${replaceCitations(
						translateKey(assessment.structuralRangeDescKey)
					)}</li>`; // <--- Terapkan di sini
				}
				structuralListEl.innerHTML =
					structuralHtml || `<li>${translateKey("damage_no_significant")}</li>`;

				// Bangun HTML Equipment (apply replaceCitations)
				equipmentListEl.innerHTML = assessment.equipmentKey
					? `<li>${replaceCitations(
							translateKey(assessment.equipmentKey)
					  )}</li>` // <--- Terapkan di sini
					: `<li>${translateKey("equipment_no_significant")}</li>`;
				// --- AKHIR PERUBAHAN ---
			}

			// --- Logika Peringatan Ekstrapolasi ---
			const panelContentEl = $(`panel-damage-${method}`).querySelector(".pad");
			const existingWarnings = panelContentEl.querySelectorAll(
				".extrapolation-warning, .extrapolation-warning-crowl, .extrapolation-warning-sadovski"
			);
			existingWarnings.forEach((el) => el.remove());
			let warningKey = null;
			const zeValue = parseFloat($("Ze")?.value);
			if (
				method === "crowl" &&
				!isNaN(zeValue) &&
				(zeValue < 0.01 || zeValue > 100)
			) {
				warningKey = "crowl_warning";
			} else if (method === "alonso" && isAlonsoExtrapolated) {
				warningKey = "alonso_warning";
			} else if (
				method === "sadovski" &&
				!isNaN(zeValue) &&
				(zeValue < 1 || zeValue > 15)
			) {
				warningKey = "sadovski_warning";
			}
			if (warningKey && isPoValid) {
				const poValueParagraph = valPoEl.parentElement;
				if (poValueParagraph) {
					const warningDiv = document.createElement("div");
					warningDiv.className = `extrapolation-warning extrapolation-warning-${method}`;
					warningDiv.style.cssText =
						"color: var(--danger); font-weight: bold; font-style: italic; font-size: 13px; margin: 4px 0 10px;";
					warningDiv.textContent = translateKey(warningKey); // Gunakan translateKey global
					poValueParagraph.insertAdjacentElement("afterend", warningDiv);
				}
			}
			// --- Akhir Logika Warning ---
		}); // Akhir forEach
	} // Akhir updateEstimationPanels

	// ------------------------------------------------------------------------
	// --- FUNGSI UPDATE PANEL ESTIMASI CEDERA (VERSI LENGKAP & DIPERBAIKI) ---
	// ------------------------------------------------------------------------
	function updateInjuryPanels(
		PoCrowl,
		PoAlonso,
		PoSadovski,
		isAlonsoExtrapolated = false,
		assessmentDataFromArgs
	) {
		// --- Logika Pengambilan Data Asesmen (Sama seperti di atas) ---
		let assessmentData = null;
		if (assessmentDataFromArgs !== undefined) {
			assessmentData = assessmentDataFromArgs;
			// console.log("updateInjuryPanels: Using data from arguments.");
		} else if (lastApiResults && lastApiResults.assessments) {
			assessmentData = lastApiResults.assessments;
			// console.log("updateInjuryPanels: Using data from global lastApiResults.");
		} else {
			// console.log("updateInjuryPanels: No assessment data available.");
		}
		// 'assessmentData' sekarang berisi data yang benar atau null

		// Fungsi internal untuk update per panel (Crowl, Alonso, Sadovski)
		const updateSinglePanel = (method, Po) => {
			const isPoValid = Number.isFinite(Po);
			// Ambil data asesmen spesifik (bisa null)
			const assessment =
				assessmentData && assessmentData[method]
					? assessmentData[method]
					: null;
			// Ambil data efek injury (bisa null)
			const injuryEffects = assessment ? assessment.injuryEffects : null;

			// --- Referensi Elemen HTML (PENTING ADA SEMUA) ---
			const valPoEl = $(`val-Po-${method}-inj`);
			const effectsListEl = $(`injury-effects-${method}`);
			const sevFootEl = $(`sev-injury-${method}`);

			// Lewati jika elemen tidak ditemukan
			if (!valPoEl || !effectsListEl || !sevFootEl) {
				console.error(`Missing elements for injury panel: ${method}`);
				return;
			}

			// --- Tentukan Kunci Kategori ---
			// Ambil dari assessment jika valid, jika tidak pakai 'injury_cat_invalid'
			// (Logika ini sudah benar, tidak perlu diubah)
			const injuryCategoryNameKey =
				isPoValid && assessment && assessment.injuryCategoryNameKey
					? assessment.injuryCategoryNameKey
					: "injury_cat_invalid";

			// console.log(`Injury Panel (${method}) - Final Key: "${injuryCategoryNameKey}"`);

			// --- Update Tampilan ---
			// Label Severity (Teks & Warna)
			sevFootEl.textContent = translateKey(
				injuryCategoryNameKey,
				"injury_cat_invalid"
			); // Gunakan translateKey global
			if (isPoValid && assessment) {
				sevFootEl.style.backgroundColor =
					assessment.injuryColor || "var(--muted)";
				sevFootEl.style.color = assessment.injuryTextColor || "#FFFFFF";
			} else {
				// Gaya default jika tidak valid
				sevFootEl.style.backgroundColor = "var(--muted)";
				sevFootEl.style.color = "#FFFFFF";
			}

			// Nilai Overpressure (Po)
			valPoEl.textContent = isPoValid
				? Po.toLocaleString(undefined, {
						minimumFractionDigits: 3,
						maximumFractionDigits: 3,
				  })
				: "—";

			// Detail Efek Injury (List <ul>)
			if (!isPoValid || !injuryEffects) {
				// Periksa juga injuryEffects
				effectsListEl.innerHTML = `<li>${translateKey("awaiting_input")}</li>`;
			} else {
				// Bangun HTML efek injury
				let html = "";
				// --- AWAL PERUBAHAN ---
				if (injuryEffects.primaryKey) {
					// Terapkan replaceCitations setelah translateKey
					html += `<li><strong>${translateKey(
						"primary_effects_label"
					)}</strong> ${replaceCitations(
						translateKey(injuryEffects.primaryKey)
					)}</li>`; // <--- Terapkan di sini
				}
				if (injuryEffects.secondaryKey) {
					// Terapkan replaceCitations setelah translateKey
					html += `<li><strong>${translateKey(
						"secondary_tertiary_effects_label"
					)}</strong> ${replaceCitations(
						translateKey(injuryEffects.secondaryKey)
					)}</li>`; // <--- Terapkan di sini
				}
				if (injuryEffects.conclusionKey) {
					// Terapkan replaceCitations setelah translateKey
					html += `<li><strong>${translateKey(
						"conclusion_label"
					)}</strong> ${replaceCitations(
						translateKey(injuryEffects.conclusionKey)
					)}</li>`; // <--- Terapkan di sini
				}
				// --- AKHIR PERUBAHAN ---
				effectsListEl.innerHTML =
					html || `<li>${translateKey("injury_no_significant_effects")}</li>`;
			}

			// --- Logika Peringatan Ekstrapolasi ---
			const panelContentEl = $(`panel-injury-${method}`).querySelector(".pad");
			const existingWarnings = panelContentEl.querySelectorAll(
				".extrapolation-warning, .extrapolation-warning-crowl-inj, .extrapolation-warning-sadovski-inj"
			);
			existingWarnings.forEach((el) => el.remove());
			let warningKey = null;
			const zeValue = parseFloat($("Ze")?.value);
			if (
				method === "crowl" &&
				!isNaN(zeValue) &&
				(zeValue < 0.01 || zeValue > 100)
			) {
				warningKey = "crowl_warning";
			} else if (method === "alonso" && isAlonsoExtrapolated) {
				warningKey = "alonso_warning";
			} else if (
				method === "sadovski" &&
				!isNaN(zeValue) &&
				(zeValue < 1 || zeValue > 15)
			) {
				warningKey = "sadovski_warning";
			}
			if (warningKey && isPoValid) {
				const poValueParagraph = valPoEl.parentElement;
				if (poValueParagraph) {
					const warningDiv = document.createElement("div");
					warningDiv.className = `extrapolation-warning extrapolation-warning-${method}-inj`;
					warningDiv.style.cssText =
						"color: var(--danger); font-weight: bold; font-style: italic; font-size: 13px; margin: 4px 0 10px;";
					warningDiv.textContent = translateKey(warningKey); // Gunakan translateKey global
					poValueParagraph.insertAdjacentElement("afterend", warningDiv);
				}
			}
			// --- Akhir Logika Warning ---
		}; // Akhir dari updateSinglePanel

		// Panggil updateSinglePanel untuk setiap metode
		updateSinglePanel("crowl", PoCrowl);
		updateSinglePanel("alonso", PoAlonso);
		updateSinglePanel("sadovski", PoSadovski);
	} // Akhir dari updateInjuryPanels
	// Ini adalah fungsi BARU di dalam file HTML Anda (atau di file .js eksternal)
	// Fungsi ini TIDAK berisi formula.
	async function calculateValues(isInitialLoad = false) {
		// Ambil referensi ke tombol simpan
		const btnSaveFloat = $("btnSaveResultFloat");
		const btnAddResult = $("btnAddResult");

		// --- 1. Bagian validasi input (tetap di frontend) ---
		fields.forEach((id) => $(id)?.classList.remove("input-error"));
		let hasError = false;
		const getFloat = (id) => {
			const el = $(id);
			const val = parseFloat(el.value);
			if (isNaN(val)) {
				el.classList.add("input-error");
				hasError = true;
			}
			return val;
		};
		const [rho, vol, dh, eta, e_tnt, dist, pa] = fields.map(getFloat);
		if (!(eta >= 0 && eta <= 1)) {
			$("eta").classList.add("input-error");
			hasError = true;
		}
		if (!(e_tnt > 0)) {
			$("e_tnt").classList.add("input-error");
			hasError = true;
		}

		// Fungsi untuk reset (tetap di frontend)
		const resetAll = (msgKey) => {
			[
				"W_mass",
				"E_total",
				"W_tnt",
				"Ze",
				"Ps",
				"Po_crowl",
				"Po_alonso",
				"Po_sadovski",
			].forEach((id) => ($(id).value = ""));
			lastApiResults = null; // <-- TAMBAHKAN RESET INI
			showStatusMessage(msgKey, true);
			updateEstimationPanels(NaN, NaN, NaN);
			updateInjuryPanels(NaN, NaN, NaN);
			updateFloatingPanelOutputs(NaN, NaN, NaN, false);
			updatePsVsZeChart(); // Clear chart
			if (btnSaveFloat) btnSaveFloat.disabled = true;
			if (btnAddResult) btnAddResult.disabled = true;
		};

		if (hasError) return resetAll("status_error_range");

		// --- 2. Panggil API (Ini bagian yang berubah total) ---
		try {
			// Tampilkan status loading (opsional)
			showStatusMessage("Menghitung di server...", false);

			// Kumpulkan data untuk dikirim ke API
			const inputData = { rho, vol, dh, eta, e_tnt, dist, pa };

			// Panggil API Anda!
			const response = await fetch("/explosion/tnt-equivalence", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(inputData),
			});

			// Ambil hasil JSON dari server
			const results = await response.json();

			// Jika server mengembalikan error (misal: input tidak valid)
			if (!response.ok) {
				lastApiResults = null; // <-- Reset jika error
				throw new Error(results.message || "Error tidak diketahui dari server");
			}

			// Simpan hasil *sebelum* menampilkannya
			lastApiResults = results; // <-- Simpan hasil yang valid

			// --- 3. Tampilkan hasil dari server (Frontend hanya menampilkan) ---
			$("W_mass").value = results.W_mass.toFixed(3);
			$("E_total").value = results.E_total.toFixed(3);
			$("W_tnt").value = results.W_tnt.toFixed(3);
			$("Ze").value = results.Ze.toFixed(3);
			$("Ps").value = results.Ps.toFixed(3);
			$("Po_crowl").value = results.Po_crowl.toFixed(3);
			$("Po_alonso").value = results.Po_alonso.toFixed(3);
			$("Po_sadovski").value = results.Po_sadovski.toFixed(3);

			// --- 4. Panggil fungsi UI Anda yang lain (TIDAK BERUBAH) ---
			updateEstimationPanels(
				results.Po_crowl,
				results.Po_alonso,
				results.Po_sadovski,
				results.isAlonsoExtrapolated,
				results.assessments
			);
			updateInjuryPanels(
				results.Po_crowl,
				results.Po_alonso,
				results.Po_sadovski,
				results.isAlonsoExtrapolated,
				results.assessments
			);
			updateFloatingPanelOutputs(
				results.Po_crowl,
				results.Po_alonso,
				results.Po_sadovski,
				true
			);
			updatePsVsZeChart();

			showStatusMessage("status_success");
			if (btnSaveFloat) btnSaveFloat.disabled = false;
			if (btnAddResult) btnAddResult.disabled = false;

			if (!isInitialLoad) {
				saveFormStateToLocalStorage();
			}
		} catch (error) {
			console.error("Fetch Error:", error);
			resetAll("status_error_invalid_ze"); // Gunakan pesan error yang relevan
			showStatusMessage(error.message, true); // Tampilkan pesan error dari server
		}
	}

	function compute(isInitialLoad = false) {
		if ($("pa").value === "" || isNaN(parseFloat($("pa").value)))
			$("pa").value = "101.325";
		calculateValues(isInitialLoad);
	}

	function renderEquation(material) {
		const box = $("eq-text");
		if (!box) return;
		if (!material || !eqMap[material]) {
			box.innerHTML = translations[currentLanguage].eq_panel_placeholder;
			return;
		}
		box.innerHTML = eqMap[material]
			.map(
				(item) =>
					`<div class="rxn"><small>${
						translations[currentLanguage][item.labelKey]
					}</small><div class="rxn-eq">${item.eq}</div></div>`
			)
			.join("");
	}

	function saveStateToURL() {
		try {
			const params = new URLSearchParams();
			inputFields.forEach((id) => {
				const el = $(id);
				if (el && el.value !== undefined && el.value !== "")
					params.set(id, el.value);
			});
			const q = params.toString();
			const url = q
				? `${window.location.pathname}?${q}`
				: window.location.pathname;
			window.history.replaceState({}, "", url);
		} catch (error) {
			console.warn("Could not save state to URL:", error.message);
		}
	}

	function loadStateFromURL() {
		let stateLoaded = false;
		try {
			const savedStateJSON = localStorage.getItem("explosionSimState");
			if (savedStateJSON) {
				const savedState = JSON.parse(savedStateJSON);
				inputFields.forEach((id) => {
					if (savedState[id] !== undefined) {
						const el = $(id);
						if (el) el.value = savedState[id];
					}
				});
				stateLoaded = true;
			}
		} catch (error) {
			console.error("Gagal memuat state dari localStorage:", error);
			localStorage.removeItem("explosionSimState");
		}

		// --- AWAL BAGIAN YANG DIPERBAIKI ---
		// Jika tidak ada state tersimpan (pengguna baru), muat default Beirut
		if (!stateLoaded && simulationLog.length > 0) {
			const firstLog = simulationLog[0]; // Data Beirut node 1
			const materialSelect = $("material");
			// Temukan nilai <option> yang sesuai dengan singkatan material
			const materialValue = Array.from(materialSelect.options).find(
				(opt) =>
					(materialAbbreviationMap[opt.text] || opt.value) === firstLog.material
			)?.value;
			if (materialValue) {
				materialSelect.value = materialValue;
				// 1. Muat nilai preset (rho, dh, dll.) dari material yang dipilih
				const p = presets[materialValue];
				if (p) {
					Object.keys(p).forEach((key) => {
						if ($(key)) $(key).value = p[key];
					});
				}
				// 2. Timpa nilai volume & jarak dengan data spesifik dari log
				$("vol").value = firstLog.vol;
				$("dist").value = firstLog.dist;
			}
		}
		// --- AKHIR BAGIAN YANG DIPERBAIKI ---

		renderEquation($("material").value);
		// Panggil compute HANYA SEKALI di akhir, setelah semua nilai form diatur
		compute(true);
		syncFloatingPanelInputs();
	}

	function renderLogTable() {
		const logTbody = $("logTbody");
		if (!logTbody) return;

		logTbody.innerHTML = "";

		if (simulationLog.length === 0) {
			logTbody.innerHTML = `<tr class="log-placeholder"><td colspan="18">${translations[currentLanguage].log_placeholder}</td></tr>`;
			return;
		}

		simulationLog.forEach((log, index) => {
			const row = document.createElement("tr");
			if (log.isNew) {
				row.classList.add("new-row-animation");
				delete log.isNew;
			}
			row.innerHTML = `
                <td data-label="${
									translations[currentLanguage].log_col_node
								}">${index + 1}</td>
                <td data-label="${
									translations[currentLanguage].log_col_material
								}">${log.material}</td>
                <td data-label="ηE">${log.eta}</td>
                <td data-label="ETNT (kJ/kg)">${log.e_tnt}</td>
                <td data-label="ρ (kg/m³)">${log.rho}</td>
                <td data-label="ΔHexp (kJ/kg)">${log.dh}</td>
                <td data-label="${
									translations[currentLanguage].log_col_volume
								} (m³)">${log.vol}</td>
                <td data-label="${
									translations[currentLanguage].log_col_distance
								} (m)">${log.dist}</td>
                <td data-label="WTNT (kg)">${log.w_tnt}</td>
                <td data-label="ze">${log.ze}</td>
                <td data-label="Ps">${log.ps}</td>
                <td data-label="Crowl (kPa)">${log.po_crowl}</td>
                <td data-label="Alonso (kPa)">${log.po_alonso}</td>
                <td data-label="Sadovski (kPa)">${log.po_sadovski}</td>
                <td data-label="Lat">${log.lat}</td>
                <td data-label="Lon">${log.lon}</td>
                <td data-label="Po Model">${log.poModel}</td>
                <td class="col-action">
                    <button class="btn-delete" data-index="${index}" title="Delete this line">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </td>
            `;
			logTbody.appendChild(row);
		});

		updatePsVsZeChart(); // Update chart whenever the log table is re-rendered
	}

	function saveLogToLocalStorage() {
		try {
			if (simulationLog.length > 0) {
				localStorage.setItem("explosionSimLog", JSON.stringify(simulationLog));
			} else {
				localStorage.removeItem("explosionSimLog");
			}
		} catch (e) {
			console.warn("Could not save simulation log to local storage:", e);
		}
	}

	function loadLog() {
		const savedLog = localStorage.getItem("explosionSimLog");
		if (savedLog) {
			try {
				const parsedLog = JSON.parse(savedLog);
				if (Array.isArray(parsedLog) && parsedLog.length > 0) {
					simulationLog = parsedLog;
					return;
				}
			} catch (e) {
				console.error("Failed to load log from local storage:", e);
			}
		}
		// Fallback to the default scenario (Beirut)
		simulationLog = [...simulationScenarios.beirut.data];
	}
	const toTopBtn = $("toTop");
	if (toTopBtn) {
		window.addEventListener("scroll", () => {
			if (window.scrollY > 200) {
				toTopBtn.classList.add("show");
			} else {
				toTopBtn.classList.remove("show");
			}
		});
	}

	const dropdown = document.querySelector(".dropdown-menu");
	// Pastikan elemen dropdown ada sebelum menambahkan event listener
	if (dropdown) {
		const dropdownToggle = dropdown.querySelector(".dropdown-toggle");
		// Event listener untuk tombol menu
		if (dropdownToggle) {
			dropdownToggle.addEventListener("click", (event) => {
				// Mencegah event klik menyebar ke elemen lain
				event.stopPropagation();
				// Toggle class 'is-active' untuk menampilkan atau menyembunyikan menu
				dropdown.classList.toggle("is-active");
			});
		}
		// Event listener pada dokumen untuk menutup menu saat klik di luar area menu
		document.addEventListener("click", (event) => {
			// Cek jika menu sedang aktif dan klik terjadi di luar area '.dropdown-menu'
			if (
				dropdown.classList.contains("is-active") &&
				!dropdown.contains(event.target)
			) {
				dropdown.classList.remove("is-active");
			}
		});
	}

	function setupFloatingPanel() {
		const floatInputs = $("floatPanelInputs");
		const floatOutputs = $("floatPanelOutputs");
		const lang = translations[currentLanguage];
		floatInputs.innerHTML = `
          <div class="floating-group material">
            <label for="float_material" class="label">${lang.label_select_material}</label>
            <select id="float_material"></select>
          </div>
          <div class="floating-group volume">
            <label for="float_vol" class="label">${lang.label_volume}</label>
            <input id="float_vol" type="number" min="0" step="any" />
          </div>
          <div class="floating-group distance">
            <label for="float_dist" class="label">${lang.label_distance}</label>
            <input id="float_dist" type="number" min="0" step="any" />
          </div>
        `;
		floatOutputs.innerHTML = `
            <span class="label">${lang.float_overpressure_label}</span>
            <div class="output-values">
                <div class="floating-output-col"><span>Crowl</span><span id="float_po_crowl">—</span></div>
                <div class="floating-output-col"><span>Alonso</span><span id="float_po_alonso">—</span></div>
                <div class="floating-output-col"><span>Sadovski</span><span id="float_po_sadovski">—</span></div>
            </div>
            <div style="margin-top: 12px;">
                <button class="btn" id="btnSaveResultFloat" disabled style="width: 100%;">${lang.btn_add_result}</button>
            </div>
        `;

		const originalSelect = $("material");
		const floatSelect = $("float_material");
		floatSelect.innerHTML = originalSelect.innerHTML;
		const syncValues = (source, target) => {
			if (source.value !== target.value) {
				target.value = source.value;
				const changeEvent = new Event("change", { bubbles: true });
				const inputEvent = new Event("input", { bubbles: true });
				target.dispatchEvent(changeEvent);
				target.dispatchEvent(inputEvent);
			}
		};

		["material", "vol", "dist"].forEach((id) => {
			const original = $(id);
			const float = $(`float_${id}`);
			original.addEventListener("input", () => {
				if (float.value !== original.value) float.value = original.value;
			});
			original.addEventListener("change", () => {
				if (float.value !== original.value) float.value = original.value;
			});
			float.addEventListener("input", () => syncValues(float, original));
			float.addEventListener("change", () => syncValues(float, original));
		});
	}

	function syncFloatingPanelInputs() {
		$("float_material").value = $("material").value;
		$("float_vol").value = $("vol").value;
		$("float_dist").value = $("dist").value;
	}

	function updateFloatingPanelOutputs(crowl, alonso, sadovski, enabled) {
		const floatCrowl = $("float_po_crowl");
		const floatAlonso = $("float_po_alonso");
		const floatSadovski = $("float_po_sadovski");
		const btnSaveFloat = $("btnSaveResultFloat");

		if (floatCrowl)
			floatCrowl.textContent = isNaN(crowl) ? "—" : crowl.toFixed(3);
		if (floatAlonso)
			floatAlonso.textContent = isNaN(alonso) ? "—" : alonso.toFixed(3);
		if (floatSadovski)
			floatSadovski.textContent = isNaN(sadovski) ? "—" : sadovski.toFixed(3);
		if (btnSaveFloat) btnSaveFloat.disabled = !enabled;
	}

	function makeDraggable(panel, handle) {
		let pos1 = 0,
			pos2 = 0,
			pos3 = 0,
			pos4 = 0;
		let isDragging = false;

		const dragStart = (e) => {
			if (panel.classList.contains("collapsed")) return;
			isDragging = true;
			panel.style.transition = "none";
			const rect = panel.getBoundingClientRect();
			panel.style.width = rect.width + "px";
			panel.style.left = rect.left + "px";
			panel.style.transform = "none";
			let currentEvent = e.type.startsWith("touch") ? e.touches[0] : e;
			pos3 = currentEvent.clientX;
			pos4 = currentEvent.clientY;
			document.addEventListener("mouseup", dragEnd);
			document.addEventListener("mousemove", elementDrag);
			document.addEventListener("touchend", dragEnd);
			document.addEventListener("touchmove", elementDrag, { passive: false });
			document.body.classList.add("dragging");
		};

		handle.addEventListener("mousedown", dragStart);
		// BUG FIX: Pindahkan event listener 'touchstart' ke luar dari fungsi 'dragStart'
		// untuk mencegah penambahan listener berulang kali (memory leak).
		handle.addEventListener("touchstart", dragStart, { passive: false });

		function elementDrag(e) {
			if (!isDragging) return;
			if (e.type === "touchmove") e.preventDefault();
			let currentEvent = e.type.startsWith("touch") ? e.touches[0] : e;
			if (!currentEvent.clientX) return;
			pos1 = pos3 - currentEvent.clientX;
			pos2 = pos4 - currentEvent.clientY;
			pos3 = currentEvent.clientX;
			pos4 = currentEvent.clientY;
			panel.style.top = panel.offsetTop - pos2 + "px";
			panel.style.left = panel.offsetLeft - pos1 + "px";
			panel.style.bottom = "auto";
		}

		function dragEnd() {
			if (!isDragging) return;
			isDragging = false;
			panel.style.transition = "";
			panel.style.width = ""; // Reset width to be responsive
			document.removeEventListener("mouseup", dragEnd);
			document.removeEventListener("mousemove", elementDrag);
			document.removeEventListener("touchend", dragEnd);
			document.removeEventListener("touchmove", elementDrag);
			document.body.classList.remove("dragging");
		}
	}

	const floatingPanel = $("floatingControlPanel");
	makeDraggable(
		floatingPanel,
		floatingPanel.querySelector(".floating-panel-header")
	);
	// --- FINAL ROBUSTNESS CHECK FOR CHART LIBRARIES ---
	if (typeof echarts !== "undefined") {
		chartController = initializeChart();
	} else {
		console.error("ECharts library failed to load.");
		const chartContainer = $("chart");
		if (chartContainer)
			chartContainer.innerHTML =
				'<p style="padding: 20px; text-align: center; color: var(--danger);">Failed to load Ps vs ze chart library. Please check your internet connection.</p>';
	}

	if (typeof Chart !== "undefined") {
		overpressureChartController = initializeOverpressureChart();
	} else {
		console.error("Chart.js library failed to load.");
		const overpressureChartContainer = $("overpressureChart");
		if (overpressureChartContainer)
			overpressureChartContainer.parentElement.innerHTML =
				'<p style="padding: 20px; text-align: center; color: var(--danger);">Failed to load Po vs Distance chart library. Please check your internet connection.</p>';
	}

	let isInitializing = true; // Tambahkan penanda (flag) global ini

	const debouncedCompute = debounce(() => compute(false), 250);

	inputFields.forEach((id) => {
		const el = $(id);
		if (el && el.tagName === "INPUT") {
			el.addEventListener("input", () => {
				// Tambahkan pengecekan ini:
				// Hanya jalankan kalkulasi jika proses inisialisasi sudah selesai.
				if (!isInitializing) {
					debouncedCompute();
				}
			});
		}
	});

	const materialSel = $("material");
	materialSel.addEventListener("change", () => {
		const p = presets[materialSel.value];
		if (p) Object.keys(p).forEach((key) => ($(key).value = p[key]));
		renderEquation(materialSel.value);
		showStatusMessage("status_loaded_defaults");
		compute(false);
	});

	materialSel.addEventListener("init-load", () => {
		const p = presets[materialSel.value];
		if (p) Object.keys(p).forEach((key) => ($(key).value = p[key]));
		renderEquation(materialSel.value);
		compute(true);
	});

	const saveAction = () => {
		const btnSaveFloat = $("btnSaveResultFloat");
		const btnAddResult = $("btnAddResult");
		if (btnSaveFloat.disabled && btnAddResult.disabled) return;
		// --- AWAL PERBAIKAN ---
		let newLat, newLon;

		// Cek status CRS peta SAAT INI (via variabel global 'window.map')
		if (window.map && window.map.options.crs === L.CRS.Cartesian) {
			// Jika peta sedang dalam mode Kartesius, paksa koordinat baru menjadi "null"
			newLat = "null";
			newLon = "null";
		} else {
			// Jika tidak, gunakan nilai geo dari input field
			newLat = $("mapLat").value;
			newLon = $("mapLon").value;
		}
		// --- AKHIR PERBAIKAN ---
		const selectedOption = materialSel.options[materialSel.selectedIndex];
		const newLogEntry = {
			material:
				materialAbbreviationMap[selectedOption.text] || selectedOption.text,
			eta: $("eta").value,
			e_tnt: $("e_tnt").value,
			rho: $("rho").value,
			dh: $("dh").value,
			vol: $("vol").value,
			dist: $("dist").value,
			w_tnt: $("W_tnt").value,
			ze: $("Ze").value,
			ps: $("Ps").value,
			po_crowl: $("Po_crowl").value || "N/A",
			po_alonso: $("Po_alonso").value || "N/A",
			po_sadovski: $("Po_sadovski").value || "N/A",
			lat: newLat,
			lon: newLon,
			poModel: $("poModelSelect").value,
			isNew: true,
		};

		if (JSON.stringify(simulationLog) === JSON.stringify(simulationScenarios)) {
			simulationLog = [];
		}

		simulationLog.unshift(newLogEntry);

		if (simulationLog.length > 10) {
			simulationLog.pop();
		}

		renderLogTable();
		updateOverpressureChartFromLog();
		saveLogToLocalStorage();
		showStatusMessage("status_log_saved"); // Memberikan umpan balik yang jelas kepada pengguna
	};

	const btnAddResult = $("btnAddResult");
	if (btnAddResult) btnAddResult.addEventListener("click", saveAction);

	// Atur event listener untuk panel melayang di sini untuk mencegah penambahan ganda.
	// Menggunakan delegasi event, sehingga listener tetap berfungsi bahkan jika tombol di dalamnya dibuat ulang.
	const floatingPanelForEvent = $("floatingControlPanel");
	if (floatingPanelForEvent) {
		floatingPanelForEvent.addEventListener("click", (event) => {
			if (event.target && event.target.id === "btnSaveResultFloat") {
				saveAction();
			}
		});
	}

	const logTbody = $("logTbody");
	// *** MODIFICATION START ***
	// Fungsi ini akan dipanggil oleh handleLogRowClick untuk menampilkan popup.
	function showMapPopupForLog(logData) {
		// Memastikan peta dan fungsi-fungsi yang diperlukan tersedia di objek window.
		// Variabel-variabel ini diekspos oleh skrip peta (di blok window.load).
		if (
			typeof window.map === "undefined" ||
			typeof window.destPoint === "undefined"
		) {
			console.error(
				"Objek peta (map) atau fungsi destPoint tidak tersedia. Pastikan skrip peta telah dimuat."
			);
			return;
		}

		const lat = parseFloat(logData.lat);
		const lon = parseFloat(logData.lon);
		const radius = parseFloat(logData.dist);

		if (isNaN(lat) || isNaN(lon)) {
			// KASUS 1: DATA LAT/LON NULL
			// Panggil fungsi global untuk beralih ke peta Kartesius.
			if (typeof window.switchToCartesianMap === "function") {
				window.switchToCartesianMap();
			}
			// Kita tidak bisa menampilkan popup geo, jadi kita berhenti di sini.
			return;
		}

		// KASUS 2: DATA LAT/LON VALID
		// Panggil fungsi global untuk memastikan kita berada di peta geografis.
		if (typeof window.switchToGeoMap === "function") {
			// Berikan koordinat baru agar peta bisa berpusat di sana.
			window.switchToGeoMap([lat, lon]);
		}

		// --- AKHIR PERUBAHAN LOGIKA ---
		if (isNaN(radius)) return;
		// Pilih nilai Po berdasarkan model yang aktif di peta.
		const poModelSelect = $("poModelSelect");
		const selectedModel = poModelSelect ? poModelSelect.value : "crowl";
		const modelKeyMap = {
			crowl: "po_crowl",
			alonso: "po_alonso",
			sadovski: "po_sadovski",
		};
		const poKey = modelKeyMap[selectedModel];
		const poValue = logData[poKey]
			? parseFloat(logData[poKey]).toFixed(3)
			: "N/A";

		// Konten popup.
		const popupContent = `<b>r = ${radius} m</b><br>Po: ${poValue}`;

		// Hitung posisi untuk popup di tepi lingkaran (misalnya, arah timur laut).
		const popupLatLng = window.destPoint(lat, lon, radius, 45); // 45 derajat bearing

		// Buka popup di peta. Leaflet akan menangani penutupan popup yang sudah ada.
		window.map.openPopup(popupContent, popupLatLng);
	}

	// Fungsi yang diperbarui untuk menangani klik pada baris log
	function handleLogRowClick(event) {
		const row = event.target.closest("tr");
		// Abaikan klik jika bukan pada baris data atau jika pada tombol hapus
		if (
			!row ||
			row.classList.contains("log-placeholder") ||
			event.target.closest(".btn-delete")
		) {
			return;
		}

		const deleteButton = row.querySelector(".btn-delete");
		if (!deleteButton) return;

		const index = parseInt(deleteButton.dataset.index, 10);
		if (isNaN(index) || !simulationLog[index]) return;

		// 1. Ambil data dari array simulationLog berdasarkan indeks
		const logData = simulationLog[index];
		// *** NEW FEATURE: Panggil fungsi untuk menampilkan popup di peta. ***
		showMapPopupForLog(logData);

		// 2. Perbarui nilai pada form input utama
		$("vol").value = logData.vol;
		$("dist").value = logData.dist;
		$("rho").value = logData.rho;
		$("dh").value = logData.dh;
		$("eta").value = logData.eta;
		$("e_tnt").value = logData.e_tnt;

		// Mengubah material sedikit lebih rumit karena perlu memicu event 'change'
		const materialSelect = $("material");
		// Temukan nilai <option> yang sesuai dengan singkatan material (misal: 'AN')
		const materialValue = Array.from(materialSelect.options).find(
			(opt) =>
				(materialAbbreviationMap[opt.text] || opt.value) === logData.material
		)?.value;

		if (materialValue && materialSelect.value !== materialValue) {
			materialSelect.value = materialValue;
			// 3. Memicu event 'change' secara manual untuk menjalankan semua logika terkait
			materialSelect.dispatchEvent(new Event("change"));
		} else {
			// Jika material tidak berubah, panggil `compute()` secara manual
			compute(true);
		}

		// 4. Atur sorotan visual pada baris yang dipilih
		document
			.querySelectorAll("#logTable tbody tr.selected-row")
			.forEach((selectedRow) => {
				selectedRow.classList.remove("selected-row");
			});
		row.classList.add("selected-row");

		// 5. Beri notifikasi kepada pengguna
		showStatusMessage(
			`Data dari log #${index + 1} telah dimuat ke kalkulator.`
		);
	}
	// *** MODIFICATION END ***
	// Tambahkan event listener ke <tbody>
	logTbody.addEventListener("click", handleLogRowClick);
	logTbody.addEventListener("click", (event) => {
		const deleteButton = event.target.closest(".btn-delete");
		if (deleteButton) {
			const indexToDelete = parseInt(deleteButton.dataset.index, 10);
			if (!isNaN(indexToDelete)) {
				simulationLog.splice(indexToDelete, 1);
				renderLogTable();
				updateOverpressureChartFromLog();
				saveLogToLocalStorage();
			}
		}
	});

	const btnSortLog = $("btnSortLog");
	btnSortLog.addEventListener("click", () => {
		if (simulationLog.length > 1) {
			simulationLog.sort((a, b) => parseFloat(a.dist) - parseFloat(b.dist));
			renderLogTable();
			updateOverpressureChartFromLog();
			saveLogToLocalStorage();
		}
	});

	const btnExportLog = $("btnExportLog");
	const btnImportLog = $("btnImportLog");
	const importFileInput = $("importFile");

	btnExportLog.addEventListener("click", () => {
		if (simulationLog.length === 0) {
			showStatusMessage("status_log_empty_export", true);
			return;
		}

		const headers = Object.keys(simulationLog[0]).filter(
			(key) => key !== "isNew"
		);

		const escapeCsvCell = (cell) => {
			const strCell = cell === null || cell === undefined ? "" : String(cell);
			if (/[",\n\r]/.test(strCell)) {
				return `"${strCell.replace(/"/g, '""')}"`;
			}
			return strCell;
		};

		const csvRows = [headers.join(",")];

		simulationLog.forEach((log) => {
			const values = headers.map((header) => escapeCsvCell(log[header]));
			csvRows.push(values.join(","));
		});

		const csvString = csvRows.join("\n");
		const dataBlob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(dataBlob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "simulation-log.csv";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		showStatusMessage("status_export_success");
	});

	btnImportLog.addEventListener("click", () => {
		importFileInput.click();
	});

	importFileInput.addEventListener("change", (event) => {
		const file = event.target.files[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const csv = e.target.result;
				const lines = csv.split(/\r\n|\n/).filter((line) => line.trim() !== "");

				let newLat, newLon, newPoModel;
				const dataLines = lines.filter((line) => {
					if (line.startsWith("#")) {
						const parts = line.substring(1).split(",");
						if (parts.length >= 2) {
							const key = `#${parts[0].trim()}`;
							const value = parts[1].trim();
							if (key === "#mapLat") newLat = parseFloat(value);
							else if (key === "#mapLon") newLon = parseFloat(value);
							else if (key === "#poModel") newPoModel = value;
						}
						return false;
					}
					return true;
				});

				if (
					typeof newLat === "number" &&
					!isNaN(newLat) &&
					typeof newLon === "number" &&
					!isNaN(newLon)
				) {
					settings.lat = newLat;
					settings.lon = newLon;
					savePartial({ lat: newLat, lon: newLon });
					updateCoordInputs();
					if (typeof map !== "undefined" && map.setView) {
						map.setView([newLat, newLon]);
					}
				}

				if (
					newPoModel &&
					["crowl", "alonso", "sadovski"].includes(newPoModel)
				) {
					const poModelSelect = document.getElementById("poModelSelect");
					if (poModelSelect) poModelSelect.value = newPoModel;
					settings.poModel = newPoModel;
					savePartial({ poModel: newPoModel });
				}

				if (dataLines.length < 1) {
					if (newLat !== undefined || newPoModel !== undefined) {
						showStatusMessage("status_import_success");
						simulationLog = [];
					} else {
						throw new Error(
							translations[currentLanguage].status_import_error_empty
						);
					}
				} else {
					const headers = dataLines[0].split(",").map((h) => h.trim());
					const requiredHeaders = [
						"material",
						"eta",
						"e_tnt",
						"rho",
						"dh",
						"vol",
						"dist",
						"w_tnt",
						"ze",
						"ps",
						"po_crowl",
						"po_alonso",
						"po_sadovski",
						"lat",
						"lon",
						"poModel",
					];
					const missingHeaders = requiredHeaders.filter(
						(rh) => !headers.includes(rh)
					);

					if (missingHeaders.length > 0) {
						throw new Error(
							`${
								translations[currentLanguage].status_import_error_missing_cols
							}${missingHeaders.join(", ")}`
						);
					}

					const importedData = [];
					const numericalHeaders = [
						"eta",
						"e_tnt",
						"vol",
						"dist",
						"w_tnt",
						"ze",
						"ps",
					];
					const poHeaders = ["po_crowl", "po_alonso", "po_sadovski"];

					for (let i = 1; i < dataLines.length; i++) {
						const rowNum = i + 1;
						const values = dataLines[i].split(",").map((v) => v.trim());
						if (values.length !== headers.length) continue;

						const logEntry = {};
						for (let j = 0; j < headers.length; j++) {
							const header = headers[j];
							const value = values[j];

							if (
								numericalHeaders.includes(header) &&
								isNaN(parseFloat(value))
							) {
								throw new Error(
									`Data tidak valid di baris ${rowNum} (kolom "${header}"). Harap masukkan angka yang valid.`
								);
							}
							if (
								poHeaders.includes(header) &&
								isNaN(parseFloat(value)) &&
								value.toUpperCase() !== "N/A"
							) {
								throw new Error(
									`Data tidak valid di baris ${rowNum} (kolom "${header}"). Harap masukkan angka yang valid atau 'N/A'.`
								);
							}
							logEntry[header] = value;
						}
						importedData.push(logEntry);
					}

					simulationLog = importedData.slice(0, 10);
					showStatusMessage("status_import_success");
				}

				renderLogTable();
				updateOverpressureChartFromLog();
				saveLogToLocalStorage();

				if (simulationLog.length > 0) {
					// --- AWAL BAGIAN YANG DIPERBAIKI ---
					try {
						const firstLog = simulationLog[0];
						const materialSelect = $("material");

						const findMaterialValue = (abbr) => {
							const options = materialSelect.options;
							for (let i = 0; i < options.length; i++) {
								// Pencocokan yang lebih kuat, mengabaikan spasi ekstra
								const optionText = options[i].text.trim();
								if (
									(materialAbbreviationMap[optionText] || options[i].value) ===
									abbr.trim()
								) {
									return options[i].value;
								}
							}
							return "";
						};

						const materialValue = findMaterialValue(firstLog.material);
						if (materialValue) {
							// 1. Atur semua nilai form terlebih dahulu
							materialSelect.value = materialValue;
							$("vol").value = firstLog.vol;
							$("dist").value = firstLog.dist;
							$("rho").value = firstLog.rho;
							$("dh").value = firstLog.dh;
							$("eta").value = firstLog.eta;
							$("e_tnt").value = firstLog.e_tnt;

							// 2. Perbarui tampilan persamaan reaksi
							renderEquation(materialValue);

							// 3. Panggil kalkulasi HANYA SEKALI di akhir
							compute(true);

							// 4. Sinkronkan dengan panel kontrol cepat
							syncFloatingPanelInputs();
						}
					} catch (e) {
						console.warn(
							"Gagal memperbarui formulir utama dari CSV yang diimpor, tetapi log berhasil dimuat.",
							e
						);
					}
					// --- AKHIR BAGIAN YANG DIPERBAIKI ---
				}
			} catch (err) {
				showStatusMessage("status_import_error", true, err.message);
			} finally {
				importFileInput.value = "";
			}

			// --- TAMBAHKAN KODE BARU DI BAWAH INI ---
			// Memicu klik pada baris pertama setelah impor CSV berhasil.
			// Ini menyamakan perilaku dengan saat memilih skenario dari dropdown.
			setTimeout(() => {
				const firstRow = document.querySelector(
					"#logTbody tr:not(.log-placeholder)"
				);
				if (firstRow) {
					firstRow.click();
				}
			}, 150); // Penundaan sedikit lebih lama untuk memastikan semua rendering selesai.
			// --- AKHIR DARI KODE TAMBAHAN ---
		};
		reader.readAsText(file);
	});

	function setupCollapsePanel() {
		const panel = $("floatingControlPanel");
		const collapseBtn = $("floatPanelCollapseBtn");
		const header = panel.querySelector(".floating-panel-header");

		const setDockedPosition = () => {
			if (!materialCard) return;
			const materialCardRect = materialCard.getBoundingClientRect();
			let targetTop = Math.max(20, materialCardRect.top);
			panel.style.setProperty("--target-top", `${targetTop}px`);
		};

		collapseBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			const isCollapsed = panel.classList.toggle("collapsed");

			if (isCollapsed) {
				const rect = panel.getBoundingClientRect();
				panel.style.setProperty("--target-top", `${rect.top}px`);
				panel.style.setProperty(
					"--target-right",
					`${window.innerWidth - rect.right}px`
				);
			} else {
				panel.style.width = ""; // Reset width
			}
		});

		header.addEventListener("click", (e) => {
			if (
				panel.classList.contains("collapsed") &&
				e.target !== collapseBtn &&
				!collapseBtn.contains(e.target)
			) {
				panel.classList.remove("collapsed");
				panel.style.width = "";
			}
		});

		window.addEventListener(
			"scroll",
			debounce(() => {
				if (panel.classList.contains("collapsed")) {
					setDockedPosition();
				}
			}, 100)
		);

		window.addEventListener(
			"resize",
			debounce(() => {
				if (panel.classList.contains("collapsed")) {
					const rect = panel.getBoundingClientRect();
					panel.style.setProperty(
						"--target-right",
						`${window.innerWidth - rect.right}px`
					);
				}
			}, 100)
		);
	}

	const materialCard = $("materialCard");
	function handlePanelVisibility() {
		if (!isPageLoaded) return; // Do not run until page has settled
		const floatingPanel = $("floatingControlPanel");
		if (!materialCard || !floatingPanel) return;
		const cardRect = materialCard.getBoundingClientRect();
		if (cardRect.bottom < 20) {
			syncFloatingPanelInputs();
			floatingPanel.classList.add("visible");
		} else {
			floatingPanel.classList.remove("visible");
		}
	}

	window.addEventListener("scroll", handlePanelVisibility);

	const updateOnResizeOrRotate = () => {
		handlePanelVisibility();
		const floatingPanel = $("floatingControlPanel");
		if (floatingPanel && !floatingPanel.classList.contains("collapsed")) {
			floatingPanel.style.width = "";
		}
	};

	const debouncedUpdateOnResizeOrRotate = debounce(updateOnResizeOrRotate, 150);
	window.addEventListener("resize", debouncedUpdateOnResizeOrRotate);
	window.addEventListener("orientationchange", debouncedUpdateOnResizeOrRotate);

	function loadAndDisplayScenario(scenarioKey) {
		if (!simulationScenarios[scenarioKey]) return;

		// Ganti log saat ini dengan data skenario yang dipilih
		simulationLog = [...simulationScenarios[scenarioKey].data];

		// Perbarui semua elemen UI yang relevan
		renderLogTable();
		updateOverpressureChartFromLog();
		saveLogToLocalStorage();

		// Muat entri pertama dari skenario baru ke dalam kalkulator utama
		if (simulationLog.length > 0) {
			const firstLog = simulationLog[0];
			const materialSelect = $("material");
			const materialValue = firstLog.material;
			const optionExists = Array.from(materialSelect.options).some(
				(opt) => opt.value === materialValue
			);

			if (optionExists) {
				materialSelect.value = materialValue;
				$("vol").value = firstLog.vol;
				$("dist").value = firstLog.dist;
				$("rho").value = firstLog.rho;
				$("dh").value = firstLog.dh;
				$("eta").value = firstLog.eta;
				$("e_tnt").value = firstLog.e_tnt;

				// Picu event 'change' agar kalkulator dan properti material ikut ter-update
				materialSelect.dispatchEvent(new Event("change"));
			} else {
				console.error(
					`Material "${materialValue}" dari data skenario tidak ditemukan di dropdown.`
				);
			}
		}

		// Panggil fungsi untuk menyorot baris pertama setelah tabel diperbarui
		highlightFirstRow();
	}

	function initializeSimulationState() {
		const selector = $("simulationSelector");
		// Coba dapatkan skenario terakhir yang dipilih dari localStorage
		const lastScenario = localStorage.getItem("lastSelectedScenario");

		if (lastScenario && simulationScenarios[lastScenario]) {
			// Jika skenario yang valid tersimpan, atur dropdown ke nilai tersebut
			selector.value = lastScenario;
			// Muat data untuk skenario yang tersimpan
			loadAndDisplayScenario(lastScenario);
		} else {
			// Jika tidak, ini adalah kunjungan pertama atau data tidak valid.
			// Atur dropdown ke skenario default 'beirut'
			selector.value = "beirut";
			// Muat data untuk skenario default
			loadAndDisplayScenario("beirut");
		}
		updateToggleButtonVisibility(selector.value);
		updateSliderVisibility(); // <-- TAMBAHKAN BARIS INI
	}

	// Fungsi ini mengisi pilihan dropdown dan mengatur listener untuk menyimpan perubahan
	function populateSimulationSelector() {
		const selector = $("simulationSelector");
		if (!selector) return;

		selector.innerHTML = "";

		Object.keys(simulationScenarios).forEach((key) => {
			const option = document.createElement("option");
			option.value = key;
			option.textContent = simulationScenarios[key].name;
			selector.appendChild(option);
		});

		selector.addEventListener("change", (event) => {
			const selectedScenarioKey = event.target.value;
			// --- AWAL KODE BARU UNTUK HIDE SLIDER ---
			if (isSliderVisible) {
				// Hanya reset jika slider sedang terlihat
				isSliderVisible = false; // Set status kembali ke hidden

				// Reset teks tombol "Real Event" / "Hide Event"
				const btnToggleSlider = $("btnToggleSlider");
				if (btnToggleSlider) {
					const newKey = "btn_toggle_slider"; // Kunci teks default
					btnToggleSlider.setAttribute("data-lang-key", newKey);
					btnToggleSlider.textContent = translateKey(
						newKey,
						"btn_toggle_slider"
					);
				}
			}
			updateToggleButtonVisibility(selectedScenarioKey);
			loadAndDisplayScenario(selectedScenarioKey);
			// --- AWAL PERBAIKAN: Reset "Select Po" dropdown ---
			const poModelSelect = $("poModelSelect"); // Helper $() Anda
			if (poModelSelect) {
				poModelSelect.value = "crowl";
				// Picu event 'change' agar peta di map-loader.js merespons
				poModelSelect.dispatchEvent(new Event("change"));
			}
			// --- AKHIR PERBAIKAN ---
			// --- AWAL KODE PERBAIKAN ---
			// Tambahkan pemicu klik di sini.
			// Ini memastikan baris pertama dari data yang baru dimuat akan diklik,
			// sehingga memicu pembaruan popup di peta.
			setTimeout(() => {
				const firstRow = document.querySelector(
					"#logTbody tr:not(.log-placeholder)"
				);
				if (firstRow) {
					firstRow.click();
				}
			}, 100);
			// --- AKHIR KODE PERBAIKAN ---

			// Simpan kunci skenario yang dipilih ke localStorage setiap kali ada perubahan
			try {
				localStorage.setItem("lastSelectedScenario", selectedScenarioKey);
			} catch (e) {
				console.warn("Gagal menyimpan skenario terakhir ke localStorage:", e);
			}
			updateSliderVisibility(); // <-- TAMBAHKAN BARIS INI
		});
	}

	// // --- INITIALIZATION SEQUENCE ---
	// initLanguage();
	// loadLogo();
	// toTopBtn.addEventListener('click', goTop);
	// populateSimulationSelector();
	// setupSliderArrows();
	// initializeSimulationState(); // <-- Satu baris ini menggantikan pemanggilan loadLog() dan render...() yang lama
	// loadStateFromURL();
	// setupCollapsePanel();
	// updatePsVsZeChart(); // Initial plot

	// isInitializing = false;

	// // ========================================================== -->
	// // GANTI BLOK INTERAKSI LAMA DENGAN YANG BARU INI
	// // ========================================================== -->
	// // Hentikan slideshow jika pengguna berinteraksi dengan slider APAPUN
	// document.querySelectorAll('.slider-nav').forEach(nav => {
	//     nav.addEventListener('click', stopSlideshow);
	// });
	// document.querySelectorAll('.slider').forEach(slider => {
	//     slider.addEventListener('pointerdown', stopSlideshow);
	// });
	// // ========================================================== -->

	// setTimeout(() => {
	//     isPageLoaded = true;
	//     handlePanelVisibility();
	// }, 250);

	const btnToggleSlider = $("btnToggleSlider");
	if (btnToggleSlider) {
		btnToggleSlider.addEventListener("click", () => {
			isSliderVisible = !isSliderVisible; // Balik status

			// Perbarui teks tombol
			const newKey = isSliderVisible ? "btn_hide_slider" : "btn_toggle_slider";
			btnToggleSlider.setAttribute("data-lang-key", newKey);
			btnToggleSlider.textContent = translateKey(newKey, "btn_toggle_slider"); // Asumsi 'translateKey' adalah fungsi global Anda

			// Terapkan perubahan visibilitas
			updateSliderVisibility();
		});
	}

	loadTranslationsAndInit();
});
