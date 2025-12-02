// --- PASTE DI SINI (SEBELUM `lastGeoCoords`) ---
// ======= BUILT-IN DEFAULTS =======
const BUILTIN_DEFAULTS = {
	lat: 33.901404,
	lon: 35.519039,
	csv: "",
	np: 90,
	iv: 250,
	os: 0.3,
	of: 0.2,
	sw: 0.3,
	pal: "bright",
	showLabel: false,
	poModel: "crowl",
};
// --- AKHIR PASTE ---
// --- AWAL TAMBAHAN GLOBAL ---
let map;
let canvasRenderer; // <-- TAMBAHKAN BARIS INI
let cartesianLayerGroup;
let currentMapMode = "";
let lastGeoCoords = [BUILTIN_DEFAULTS.lat, BUILTIN_DEFAULTS.lon]; // <-- Sekarang ini valid
// --- AKHIR TAMBAHAN GLOBAL ---

window.addEventListener("load", async () => {
	const mapContainer = document.getElementById("map");
	if (!mapContainer) {
		return;
	}
	// --- PASTE DI SINI (SEBELUM `lastGeoCoords`) ---
	// ======= BUILT-IN DEFAULTS =======
	const BUILTIN_DEFAULTS = {
		lat: 33.901404,
		lon: 35.519039,
		csv: "",
		np: 90,
		iv: 250,
		os: 0.3,
		of: 0.2,
		sw: 0.3,
		pal: "bright",
		showLabel: false,
		poModel: "crowl",
	};
	// --- AKHIR PASTE ---
	// --- AWAL TAMBAHAN GLOBAL ---
	let map;
	let canvasRenderer; // <-- TAMBAHKAN BARIS INI
	let cartesianLayerGroup;
	let currentMapMode = "";
	let lastGeoCoords = [BUILTIN_DEFAULTS.lat, BUILTIN_DEFAULTS.lon]; // <-- Sekarang ini valid
	// --- AKHIR TAMBAHAN GLOBAL ---

	window.addEventListener("load", async () => {
		const mapContainer = document.getElementById("map");
		if (!mapContainer) {
			return;
		}

		// Coba muat Leaflet dan Cartesian-CRS
		try {
			// 1. Muat Leaflet. Ini akan membuat 'L' tersedia secara global.
			if (typeof L === "undefined") {
				await import("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");
			}

			// 2. SETELAH Leaflet ada, muat skrip Cartesian Anda.
			// (Kita asumsikan getCartesianMapOptions ada di window, jika tidak, kita perlu import)
			// Kita perlu memuat file ini untuk mengeksekusinya dan menambahkan L.CRS.Cartesian
			await import("/js/cartesian-crs.js");
		} catch (e) {
			console.error("Gagal memuat skrip peta (Leaflet atau Cartesian):", e);
			mapContainer.innerHTML =
				'<p style="padding: 20px; text-align: center; color: var(--danger); font-weight: bold;">Kesalahan: Gagal memuat pustaka peta.</p>';
			return; // Hentikan eksekusi jika library penting gagal
		}

		// Periksa apakah 'L' (dari Leaflet) berhasil dimuat
		if (typeof L === "undefined") {
			console.error(
				"Pustaka Leaflet tidak dimuat. Peta tidak dapat diinisialisasi."
			);

			const mapCard = document.getElementById("mapCard");
			if (mapContainer) {
				mapContainer.innerHTML =
					'<p style="padding: 20px; text-align: center; color: var(--danger); font-weight: bold;">Kesalahan: Gagal memuat pustaka peta. Harap periksa koneksi internet Anda dan coba muat ulang halaman.</p>';
			}
			// Sembunyikan kontrol yang tidak relevan jika peta gagal dimuat
			const controls = document.getElementById("mapControls");
			if (controls) controls.style.display = "none";
			if (mapCard) mapCard.style.backgroundColor = "var(--bg)";
			return; // Hentikan eksekusi skrip peta
		}

		const LS_KEY = "explosionContour:v1";
		const RG_KEY = "explosionContour:revgeo:v2";

		let notifTimer = null;
		function showNotification(message, isError = false) {
			const el = document.getElementById("notification");
			el.textContent = message;
			el.className = "notification"; // reset
			if (isError) el.classList.add("error");
			el.classList.add("show");
			if (notifTimer) clearTimeout(notifTimer);
			notifTimer = setTimeout(() => {
				el.classList.remove("show");
			}, 4000);
		}

		// --- TAMBAHKAN FUNGSI INI ---
		/**
		 * Mengubah warna hex menjadi string rgba dengan opacity.
		 * @param {string} hex - Kode warna hex (misal, "#FF0000").
		 * @param {number} opacity - Nilai transparansi (0.0 hingga 1.0).
		 * @returns {string} - String "rgba(r, g, b, a)"
		 */
		function hexToRgba(hex, opacity) {
			let r = 0,
				g = 0,
				b = 0;
			// Handle 3 digit hex
			if (hex.length === 4) {
				r = parseInt(hex[1] + hex[1], 16);
				g = parseInt(hex[2] + hex[2], 16);
				b = parseInt(hex[3] + hex[3], 16);
			}
			// Handle 6 digit hex
			else if (hex.length === 7) {
				r = parseInt(hex.substring(1, 3), 16);
				g = parseInt(hex.substring(3, 5), 16);
				b = parseInt(hex.substring(5, 7), 16);
			}
			return `rgba(${r}, ${g}, ${b}, ${opacity})`;
		}
		// --- AKHIR TAMBAHAN ---

		// --- TAMBAHKAN FUNGSI BARU INI ---
		/**
		 * Membuat array layer poligon "donut" (annulus) yang tidak tumpang tindih.
		 */
		function createContourPolygons(
			ringsData,
			palette,
			lat,
			lon,
			np,
			weight,
			opacity
		) {
			// ringsData adalah array [ {r: 300, Po: ...}, {r: 400, Po: ...}, ... ]

			return ringsData.map((d, i) => {
				const color = palette[i % palette.length];

				// Buat koordinat untuk lingkar terluar dari zona ini
				const outerCoords = circleCoordsGeodesic(lat, lon, d.r, np);

				let polygonCoords;

				if (i === 0) {
					// Ini adalah lingkaran paling tengah (paling kecil)
					// Ini adalah poligon solid, bukan donat.
					polygonCoords = outerCoords;
				} else {
					// Ini adalah "donat".
					// Kita perlu membuat "lubang" menggunakan radius dari zona sebelumnya.
					const innerRadius = ringsData[i - 1].r;
					const innerCoords = circleCoordsGeodesic(lat, lon, innerRadius, np);

					// Format Leaflet untuk poligon dengan lubang:
					// [ [koordinat_luar], [koordinat_dalam_dibalik] ]
					polygonCoords = [outerCoords, innerCoords.reverse()];
				}

				return L.polygon(polygonCoords, {
					renderer: canvasRenderer,
					color: "#000000",
					weight: weight,
					fillColor: color, // Warna hex murni
					fillOpacity: opacity, // Opacity diterapkan di sini
				}).bindPopup(
					`<b>r = ${d.r} m</b>${
						d.Po != null
							? `<br>Po: <code>${Number(d.Po).toFixed(3)}</code>`
							: ""
					}`
				);
			});
		}

		function createCartesianCircles(ringsData, palette, weight, opacity) {
			// ringsData sudah diurutkan dari kecil ke besar
			return ringsData
				.map((d, i) => {
					const color = palette[i % palette.length];
					// L.circle() secara otomatis menggunakan 'meter' di L.CRS.Cartesian
					return L.circle([0, 0], {
						// [Y, X] center, selalu [0,0]
						radius: d.r, // Radius dalam 'meter' (unit CRS)
						renderer: canvasRenderer,
						color: "#000000",
						weight: weight,
						fillColor: color,
						fillOpacity: opacity,
									}).bindPopup(
										`<b>r = ${d.r} m</b>${
											d.Po != null ? `<br>Po: <code>${Number(d.Po).toFixed(3)}</code>` : ""
										}`
									);
				})
				.reverse(); // Balik urutan agar lingkaran terbesar digambar dulu
		}
		// ======= QS read-only =======
		function b64urlToStr(b64u) {
			try {
				const b64 =
					b64u.replace(/-/g, "+").replace(/_/g, "/") +
					"===".slice(b64u.length % 4);
				const bin = atob(b64);
				const bytes = new Uint8Array(bin.length);
				for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
				return new TextDecoder().decode(bytes);
			} catch {
				return "";
			}
		}
		function readFromQS() {
			const sp = new URLSearchParams(location.search);
			if (!sp || [...sp].length === 0) return {};
			const obj = {};
			if (sp.has("lat")) obj.lat = parseNumberLoose(sp.get("lat"));
			if (sp.has("lon")) obj.lon = parseNumberLoose(sp.get("lon"));
			if (sp.has("np"))
				obj.np = Math.max(16, Math.min(360, parseInt(sp.get("np"), 10) || 0));
			if (sp.has("iv")) obj.iv = Math.max(0, parseInt(sp.get("iv"), 10) || 0);
			if (sp.has("os"))
				obj.os = Math.max(0, Math.min(1, parseNumberLoose(sp.get("os"))));
			if (sp.has("of"))
				obj.of = Math.max(0, Math.min(1, parseNumberLoose(sp.get("of"))));
			if (sp.has("sw")) obj.sw = Math.max(0, parseNumberLoose(sp.get("sw")));
			if (sp.has("pal")) {
				const v = sp.get("pal").toLowerCase();
				if (["bright", "cerah", "default"].includes(v)) obj.pal = "bright";
				else if (["bluegreen", "biru-hijau", "biru", "hijau", "bg"].includes(v))
					obj.pal = "bluegreen";
				else if (["heat", "panas"].includes(v)) obj.pal = "heat";
			}
			if (sp.has("label")) {
				const v = sp.get("label").toLowerCase();
				obj.showLabel = !(
					v === "0" ||
					v === "false" ||
					v === "no" ||
					v === "off"
				);
			}
			if (sp.has("csvb64")) {
				const s = b64urlToStr(sp.get("csvb64") || "");
				if (s) obj.csv = s;
			} else if (sp.has("csv")) {
				let v = sp.get("csv") || "";
				obj.csv = v.replace(/\|/g, "\n").replace(/;/g, "\n");
			}
			return Object.fromEntries(
				Object.entries(obj).filter(
					([, v]) => v !== undefined && v !== null && v !== ""
				)
			);
		}

		// ======= localStorage =======
		function loadSaved() {
			try {
				const o = JSON.parse(localStorage.getItem(LS_KEY) || "null");
				return o && typeof o === "object" ? o : {};
			} catch {
				return {};
			}
		}
		function savePartial(patch) {
			settings = { ...settings, ...patch };
			try {
				localStorage.setItem(LS_KEY, JSON.stringify(settings));
			} catch (e) {
				console.warn("Could not save map settings to local storage:", e);
			}
		}

		// ======= Compose settings (QS ➜ LS ➜ Built-in) =======
		let settings = { ...BUILTIN_DEFAULTS, ...loadSaved(), ...readFromQS() };
		// ======= Geodesic helpers =======
		const R_EARTH = 6371008.8; // m
		function destPoint(latDeg, lonDeg, distanceM, bearingDeg) {
			const φ1 = (latDeg * Math.PI) / 180,
				λ1 = (lonDeg * Math.PI) / 180;
			const θ = (bearingDeg * Math.PI) / 180,
				δ = distanceM / R_EARTH;
			const sinφ1 = Math.sin(φ1),
				cosφ1 = Math.cos(φ1);
			const sinδ = Math.sin(δ),
				cosδ = Math.cos(δ);
			const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
			const φ2 = Math.asin(sinφ2);
			const y = Math.sin(θ) * sinδ * cosφ1,
				x = cosδ - sinφ1 * sinφ2;
			let λ2 = λ1 + Math.atan2(y, x);
			λ2 = ((λ2 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
			return [(φ2 * 180) / Math.PI, (λ2 * 180) / Math.PI];
		}
		window.destPoint = destPoint; // <-- TAMBAHKAN BARIS INI

		function circleCoordsGeodesic(lat0, lon0, Rm, n = 90) {
			const coords = [];
			for (let i = 0; i <= n; i++) {
				const bearing = (360 * i) / n;
				const [lat, lon] = destPoint(lat0, lon0, Rm, bearing);
				coords.push([lat, lon]);
			}
			return coords;
		}
		L.Control.Legend = L.Control.extend({
			options: {
				position: "bottomleft", // Menentukan posisi di kiri bawah
			},
			onAdd: function (map) {
				// Buat div utama untuk legenda
				const div = L.DomUtil.create("div", "leaflet-control-legend-wrapper");

				// Beri ID unik agar mudah ditemukan oleh fungsi lain
				div.id = "map-color-legend-container";

				// Beri style dasar (kotak putih transparan)
				div.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
				div.style.padding = "10px";
				div.style.borderRadius = "5px";
				div.style.boxShadow = "0 1px 5px rgba(0,0,0,0.4)";
				div.style.display = "none"; // Sembunyikan saat pertama dibuat
				div.style.maxWidth = "200px"; // Batasi lebar
				div.style.display = "none"; // Sembunyikan saat pertama dibuat

				// Hentikan event klik agar tidak 'jatuh' ke peta
				L.DomEvent.disableClickPropagation(div);
				L.DomEvent.disableScrollPropagation(div);

				return div;
			},
		});
		// ======= Map init =======
		// const map = L.map("map", {
		// 	center: [settings.lat, settings.lon],
		// 	zoom: 14,
		// 	zoomControl: false,
		// 	maxNativeZoom: 19,
		// 	maxZoom: 22,
		// });
		// new L.Control.Legend().addTo(map); // Membuat dan menambahkan kontrol legenda baru
		// window.map = map; // <-- TAMBAHKAN BARIS INI

		// const canvasRenderer = L.canvas({ padding: 0.3 });

		// const satelliteLayer = L.tileLayer(
		// 	"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
		// 	{
		// 		maxNativeZoom: 19,
		// 		maxZoom: 22,
		// 		attribution: "Tiles © Esri",
		// 	}
		// );

		// satelliteLayer.on("tileerror", function (event) {
		// 	console.error("Tile load error:", event);
		// 	showNotification(
		// 		"Failed to load map data. Check your internet connection.",
		// 		true
		// 	);
		// 	satelliteLayer.off("tileerror");
		// });
		// satelliteLayer.addTo(map);

		// L.control.scale({ imperial: false, position: "bottomright" }).addTo(map);
		// L.control.zoom({ position: "bottomright" }).addTo(map);
		// const creditHTML =
		// 	`<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a> · ` +
		// 	`<span title="Author">Credit by <a href="https://id.linkedin.com/in/virdanurlulu" target="_blank" rel="nofollow noopener">Virda Nur Lu'lu</a></span>`;
		// map.attributionControl.setPrefix(creditHTML);

		// ======= Palettes =======
		const palettes = {
			bright: [
				"#FF0000",
				"#FFA500",
				"#FFFF00",
				"#00FF00",
				"#00FFFF",
				"#0000FF",
				"#FF00FF",
				"#800080",
				"#FFC0CB",
				"#A52A2A",
			],
			bluegreen: [
				"#203a8f",
				"#2d6cdf",
				"#3fb6ff",
				"#27c3a4",
				"#15a371",
				"#0f7a54",
				"#0b533b",
				"#083b2c",
			],
			heat: [
				"#4b0d0d",
				"#7a1f0e",
				"#ad3510",
				"#e65a0d",
				"#ff8c00",
				"#ffb200",
				"#ffd000",
				"#ffe680",
			],
		};

		// ======= Reverse Geocoding (Latin/EN, cache, fallback) =======
		function esc(s) {
			return String(s || "").replace(
				/[&<>"']/g,
				(m) =>
					({
						"&": "&amp;",
						"<": "&lt;",
						">": "gt;",
						'"': "&quot;",
						"'": "&#39;",
					}[m])
			);
		}
		function isRTL(str) {
			return /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(str);
		}
		function rgKey(lat, lon) {
			return `${lat.toFixed(5)},${lon.toFixed(5)}`;
		}
		function rgLoadCache() {
			try {
				return JSON.parse(localStorage.getItem(RG_KEY) || "{}");
			} catch {
				return {};
			}
		}
		function rgSaveCache(obj) {
			try {
				localStorage.setItem(RG_KEY, JSON.stringify(obj));
			} catch {}
		}

		let isProgrammaticMove = false; // Flag to prevent moveend recursion
		async function fetchNominatimEN(lat, lon) {
			const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1&namedetails=1&accept-language=en`;
			const r = await fetch(url, {
				headers: {
					Accept: "application/json",
					"User-Agent": "ExplosionSim/1.0",
				},
			});
			if (!r.ok)
				throw new Error(`Nominatim request failed with status ${r.status}`);
			const j = await r.json();
			const a = j.address || {};
			const city = a.city || a.town;
			const country = a.country || "";
			const joined = [city, country].filter(Boolean).join(", ");
			return joined;
		}

		async function reverseGeocode(lat, lon) {
			const key = rgKey(lat, lon);
			const cache = rgLoadCache();
			const TTL = 30 * 24 * 3600 * 1000; // 30 days
			if (cache[key] && Date.now() - cache[key].ts < TTL)
				return cache[key].name;

			let geocodeError = false;
			try {
				let name = await fetchNominatimEN(lat, lon);
				if (name && !isRTL(name)) {
					cache[key] = { name, ts: Date.now() };
					rgSaveCache(cache);
					return name;
				}
			} catch (e) {
				console.error("Nominatim fetch failed:", e);
				geocodeError = true;
			}

			try {
				const r = await fetch(
					`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en`
				);
				if (r.ok) {
					const j = await r.json();
					if (j.results && j.results.length) {
						const g = j.results[0];
						const name = [g.name, g.country].filter(Boolean).join(", ");
						if (name) {
							cache[key] = { name, ts: Date.now() };
							rgSaveCache(cache);
							return name;
						}
					}
				} else {
					throw new Error(`Open-Meteo request failed with status ${r.status}`);
				}
			} catch (e) {
				console.error("Open-Meteo fetch failed:", e);
				geocodeError = true;
			}

			if (geocodeError) {
				showNotification(
					"Failed to get location name. Check your internet connection.",
					true
				);
			}
			return "";
		}

		let centerMarker = null;
		let placeName = "";
		let mapTitleEl = null;

		// ======= Heading updater =======
		function setHeading(name) {
			const label =
				name && name.trim()
					? name.trim()
					: `${settings.lat.toFixed(5)}, ${settings.lon.toFixed(5)}`;
			const txt = `${label}`;
			document.title = txt;
			if (mapTitleEl) mapTitleEl.textContent = txt;
		}

		function _attachTooltipCloseHandler(tooltip) {
			if (!tooltip || !tooltip._container) return;
			const closeBtn = tooltip._container.querySelector(".placelabel-close");
			if (closeBtn) {
				L.DomEvent.on(closeBtn, "click", (event) => {
					L.DomEvent.stop(event);
					if (centerMarker) centerMarker.closeTooltip();
				});
			}
		}

		function ensureCenterMarker(lat, lon, name) {
			if (currentMapMode === "cartesian") {
				// Jika di mode Kartesius, hapus marker jika ada, dan jangan buat yang baru
				if (centerMarker) {
					centerMarker.remove(); // Hapus dari peta
					centerMarker = null; // Hapus referensi
				}
				return; // Hentikan fungsi
			}
			if (!centerMarker) {
				centerMarker = L.marker([lat, lon]).addTo(map); // <--- GANTI JADI INI

				centerMarker.on("tooltipopen", function (e) {
					_attachTooltipCloseHandler(e.tooltip);
				});
			} else {
				centerMarker.setLatLng([lat, lon]);
			}

			if (settings.showLabel) {
				if (centerMarker.getTooltip()) centerMarker.unbindTooltip();
				return;
			}

			const locationName = name
				? esc(name)
				: `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

			const t = centerMarker.getTooltip();
			// --- AWAL PERBAIKAN ---
			if (t) {
				// Jika tooltip sudah ada, CUKUP UPDATE KONTEN-nya
				t.setContent(locationName);
			} else {
				// Jika belum ada, BUAT BARU dengan format (konten, opsi)
				centerMarker.bindTooltip(locationName, {
					// <-- Argumen 1: Konten
					permanent: true, // <-- Argumen 2: Opsi
					direction: "right",
					offset: [8, 0],
					className: "placelabel",
				});
			}
			// --- AKHIR PERBAIKAN ---

			if (!centerMarker.isTooltipOpen()) {
				centerMarker.openTooltip();
			}
		}

		async function refreshPlaceName(lat, lon) {
			placeName = await reverseGeocode(lat, lon);
			ensureCenterMarker(lat, lon, placeName);
			setHeading(placeName);
			if (!document.getElementById("legend").hidden) refreshLegend();
		}

		// ======= Animation =======
		const RESPECT_REDUCED_MOTION =
			window.matchMedia &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		let rings = parseData(settings.csv);
		let tempLayers = [],
			finalLayer = null,
			idx = 0,
			playing = false,
			finished = false,
			timer = null;

		function clearLayers() {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
			tempLayers.forEach((l) => map.removeLayer(l));
			tempLayers = [];
			if (finalLayer) {
				map.removeLayer(finalLayer);
				finalLayer = null;
			}
			const toRemove = [];
			map.eachLayer((l) => {
				if (l instanceof L.Polygon || l instanceof L.GeoJSON) {
					toRemove.push(l);
				}
			});
			toRemove.forEach((l) => map.removeLayer(l));

			// --- LOGIKA BARU UNTUK KONTROL KITA ---
			// Sembunyikan legenda kustom kita
			const leg = document.getElementById("map-color-legend-container");
			if (leg) {
				leg.innerHTML = "";
				leg.style.display = "none";
			}

			// Sembunyikan juga legenda lama (jika masih ada)
			const oldLeg = document.getElementById("legend");
			if (oldLeg) oldLeg.hidden = true;
		}
		function refreshLegend() {
			const leg = document.getElementById("map-color-legend-container");
			if (!leg) return;

			const pal = palettes[settings.pal] || palettes.bright;

			let html = `<b style="font-size: 14px; display: block; margin-bottom: 5px;">${translateKey(
				"legend_title_radius",
				"Zona Radius" // Fallback
			)}</b>`;

			rings.forEach((ring, i) => {
				const color = pal[i % pal.length]; // Warna hex murni, misal "#FF0000"

				// --- AWAL PERUBAHAN ---
				// Ubah hex murni menjadi RGBA dengan opacity dari settings
				const rgbaColor = hexToRgba(color, settings.of);
				// --- AKHIR PERUBAHAN ---

				const poLabel =
					ring.Po != null ? `(Po: ${Number(ring.Po).toFixed(3)})` : "";
				const label = `${ring.r} m ${poLabel}`;

				html += `
            <div style="display: flex; align-items: center; margin-top: 5px;">
                <span style="
                             /* --- GUNAKAN WARNA RGBA DI SINI --- */
                             background-color: ${rgbaColor}; 
                             
                             width: 25px; 
                             height: 15px; 
                             border: 1px solid #333; 
                             margin-right: 8px; 
                             display: inline-block;
                             flex-shrink: 0;">
                </span>
                <span style="font-size: 13px;">${label}</span>
            </div>
        `;
			});

			leg.innerHTML = html;
			leg.style.display = "block";

			const oldLeg = document.getElementById("legend");
			if (oldLeg) oldLeg.hidden = true;
		}

		function drawStep() {
			if (!playing) return;
			const ivUsed = RESPECT_REDUCED_MOTION ? 0 : Math.max(0, settings.iv | 0);
			if (idx < rings.length) {
				const d = rings[idx];
				const pal = palettes[settings.pal] || palettes.bright;
				let layer;

				// --- AWAL PERBAIKAN BUG 2 (ANIMASI) ---
				if (currentMapMode === "cartesian") {
					layer = L.circle([0, 0], {
						radius: d.r,
						renderer: canvasRenderer,
						color: "#000000",
						weight: settings.sw,
						fillColor: pal[idx % pal.length],
						fillOpacity: settings.os, // Opacity animasi
					})
						.bindPopup(
							`<b>r = ${d.r} m</b>${
								d.Po != null ? `<br>Po: <code>${d.Po}</code>` : ""
							}`
						)
						.addTo(map);
					if (idx === 0) {
						try {
							map.setView([0, 0], -3);
						} catch (e) {}
					}
				} else {
					// Logika Geo yang sudah ada
					const coords = circleCoordsGeodesic(
						settings.lat,
						settings.lon,
						d.r,
						settings.np
					);
					layer = L.polygon(coords, {
						renderer: canvasRenderer,
						color: "#000000",
						weight: settings.sw,
						fillColor: pal[idx % pal.length],
						fillOpacity: settings.os,
					})
						.bindPopup(
							`<b>r = ${d.r} m</b>${
								d.Po != null ? `<br>Po: <code>${d.Po}</code>` : ""
							}`
						)
						.addTo(map);
					if (idx === 0) {
						try {
							map.setView([settings.lat, settings.lon], 14);
						} catch (e) {}
					}
				}
				// --- AKHIR PERBAIKAN ---

				tempLayers.push(layer);
				idx++;
				timer = setTimeout(drawStep, ivUsed);
			} else {
				// Frame terakhir animasi (blok 'else')
				tempLayers.forEach((l) => map.removeLayer(l));
				tempLayers = [];
				const pal = palettes[settings.pal] || palettes.bright;

				// --- AWAL PERBAIKAN BUG 2 (FRAME TERAKHIR) ---
				let polygons = [];
				if (currentMapMode === "cartesian") {
					polygons = createCartesianCircles(
						rings,
						pal,
						settings.sw,
						settings.of
					);
				} else {
					polygons = createContourPolygons(
						rings,
						pal,
						settings.lat,
						settings.lon,
						settings.np,
						settings.sw,
						settings.of
					);
				}
				finalLayer = L.featureGroup(polygons).addTo(map);
				// --- AKHIR PERBAIKAN ---

				try {
					if (currentMapMode === "cartesian") {
						map.setView([0, 0], -3);
					} else {
						map.fitBounds(finalLayer.getBounds(), { padding: [20, 20] });
					}
				} catch (e) {}
				refreshLegend();
				playing = false;
				finished = true;
			}
		}

		function drawInitialState() {
			clearLayers();
			finished = true;
			playing = false;
			rings = parseData(settings.csv);

			const pal = palettes[settings.pal] || palettes.bright;

			let polygons = [];
			if (currentMapMode === "cartesian") {
				// Panggil fungsi Kartesius (menggunakan L.circle)
				polygons = createCartesianCircles(
					rings,
					pal,
					settings.sw,
					settings.of // Gunakan opacity final
				);
			} else {
				// Panggil fungsi Geo (menggunakan 'donat')
				polygons = createContourPolygons(
					rings,
					pal,
					settings.lat,
					settings.lon,
					settings.np,
					settings.sw,
					settings.of // Gunakan opacity final
				);
			}

			finalLayer = L.featureGroup(polygons).addTo(map);
			// --- AKHIR PERBAIKAN ---
			try {
				if (finalLayer && finalLayer.getLayers().length > 0) {
					isProgrammaticMove = true;
					map.fitBounds(finalLayer.getBounds(), { padding: [20, 20] });
				} else {
					isProgrammaticMove = true;
					map.setView([settings.lat, settings.lon], 14);
				}
			} catch (e) {
				// --- TAMBAHKAN INI ---
				console.error("FATAL ERROR in drawInitialState:", e);
				showNotification("Error: Gagal menggambar radius di peta.", true);
				// --- AKHIR TAMBAHAN ---
			}

			// --- LOGIKA BARU UNTUK KONTROL KITA ---
			if (rings.length > 0) {
				refreshLegend(); // Panggil fungsi baru kita untuk mengisi & menampilkan legenda
			} else {
				// Sembunyikan legenda kustom kita
				const leg = document.getElementById("map-color-legend-container");
				if (leg) {
					leg.innerHTML = "";
					leg.style.display = "none";
				}

				// Sembunyikan legenda lama jika masih ada
				const oldLeg = document.getElementById("legend");
				if (oldLeg) oldLeg.hidden = true;

				ensureCenterMarker(settings.lat, settings.lon, placeName);
			}
		}

		function play() {
			if (finished) {
				replay();
				return;
			}
			if (playing) return;
			playing = true;
			drawStep();
		}
		function pause() {
			playing = false;
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
		}
		function replay() {
			pause();
			clearLayers();
			idx = 0;
			finished = false;
			rings = parseData(settings.csv);
			play();
		}

		// ======= Fullscreen (desktop & mobile) =======
		const fsBtn = document.getElementById("fsBtn"),
			fsBtnMobile = document.getElementById("fsBtnMobile"),
			mapCard = document.getElementById("mapCard");

		function setFSLabel(on) {
			const txt = on ? "⛶ Exit Fullscreen" : "⛶ Fullscreen";
			[fsBtn, fsBtnMobile].forEach((b) => {
				if (!b) return;
				b.textContent = txt;
				b.setAttribute("aria-pressed", on ? "true" : "false");
			});
		}
		function enterFS() {
			mapCard.classList.add("fullscreen");
			document.body.classList.add("fs-lock");
			if (mapCard.requestFullscreen) {
				mapCard.requestFullscreen().catch(() => {});
			} else if (mapCard.webkitRequestFullscreen) {
				mapCard.webkitRequestFullscreen();
			}
			setFSLabel(true);
			setTimeout(() => map.invalidateSize(), 180);
		}
		function exitFS() {
			mapCard.classList.remove("fullscreen");
			document.body.classList.remove("fs-lock");
			if (document.fullscreenElement && document.exitFullscreen) {
				document.exitFullscreen().catch(() => {});
			} else if (
				document.webkitFullscreenElement &&
				document.webkitCancelFullScreen
			) {
				document.webkitCancelFullScreen();
			}
			setFSLabel(false);
			setTimeout(() => map.invalidateSize(), 180);
		}
		function toggleFS() {
			mapCard.classList.contains("fullscreen") ? exitFS() : enterFS();
		}

		fsBtn?.addEventListener("click", (e) => {
			e.stopPropagation();
			toggleFS();
		});
		fsBtnMobile?.addEventListener("click", (e) => {
			e.stopPropagation();
			toggleFS();
		});

		document.addEventListener("fullscreenchange", () => {
			const active =
				!!document.fullscreenElement ||
				mapCard.classList.contains("fullscreen");
			if (!document.fullscreenElement) {
				mapCard.classList.remove("fullscreen");
				document.body.classList.remove("fs-lock");
			}
			setFSLabel(active);
		});

		window.addEventListener("resize", () => {
			if (mapCard.classList.contains("fullscreen")) {
				clearTimeout(window.__fsRaf);
				window.__fsRaf = setTimeout(() => map.invalidateSize(), 120);
			}
		});

		// ======= Map Controls Logic =======
		const mapLatInput = document.getElementById("mapLat");
		const mapLonInput = document.getElementById("mapLon");
		const poModelSelect = document.getElementById("poModelSelect");

		function updateCoordInputs() {
			if (mapLatInput) mapLatInput.value = settings.lat.toFixed(6);
			if (mapLonInput) mapLonInput.value = settings.lon.toFixed(6);
		}

		const debouncedUpdateMapFromInput = debounce(() => {
			const latStr = mapLatInput.value.trim();
			const lonStr = mapLonInput.value.trim();

			if (latStr === "" && lonStr === "") {
				settings.lat = BUILTIN_DEFAULTS.lat;
				settings.lon = BUILTIN_DEFAULTS.lon;
				savePartial({ lat: settings.lat, lon: settings.lon });
				updateCoordInputs();
				isProgrammaticMove = true;
				map.setView([settings.lat, settings.lon]);
				refreshPlaceName(settings.lat, settings.lon).then(() => {
					drawInitialState();
				});
				showNotification("Coordinates reset to default.", false);
				return;
			}

			const lat = parseFloat(mapLatInput.value);
			const lon = parseFloat(mapLonInput.value);
			if (
				!isNaN(lat) &&
				!isNaN(lon) &&
				lat >= -90 &&
				lat <= 90 &&
				lon >= -180 &&
				lon <= 180
			) {
				// Cek jika koordinat benar-benar berubah untuk menghindari pembaruan yang tidak perlu
				if (
					Math.abs(settings.lat - lat) > 1e-7 ||
					Math.abs(settings.lon - lon) > 1e-7
				) {
					settings.lat = lat;
					settings.lon = lon;
					savePartial({ lat: lat, lon: lon });
					// Atur tampilan peta ke koordinat baru
					isProgrammaticMove = true;
					map.setView([lat, lon]);
					// Muat ulang nama tempat dan gambar ulang semuanya di lokasi baru
					refreshPlaceName(lat, lon).then(() => {
						drawInitialState();
					});
				}
			} else {
				showNotification("Invalid coordinate values.", true);
			}
		}, 750);

		if (mapLatInput)
			mapLatInput.addEventListener("input", debouncedUpdateMapFromInput);
		if (mapLonInput)
			mapLonInput.addEventListener("input", debouncedUpdateMapFromInput);
		if (poModelSelect) {
			poModelSelect.addEventListener("change", () => {
				settings.poModel = poModelSelect.value;
				//savePartial({ poModel: poModelSelect.value });
				updateMapFromLog();
				updatePsVsZeChart(); // Update chart with new Po model selection
			});
		}
		// --- TAMBAHKAN FUNGSI BARU UNTUK MENGATUR MAP ---
		/**
		 * Menghancurkan peta yang ada dan membuat ulang dengan mode yang ditentukan.
		 * @param {string} mode - 'geo' atau 'cartesian'
		 * @param {Array} centerCoords - Koordinat [lat, lon] atau [y, x]
		 */
		function initializeMap(mode, centerCoords) {
			// 1. Hancurkan peta lama jika ada
			if (map) {
				map.remove();
				map = null;
			}

			let mapOptions;
			currentMapMode = mode; // Set mode saat ini
			// --- TAMBAHKAN BARIS INI ---
			// Inisialisasi renderer untuk peta baru ini
			canvasRenderer = L.canvas({ padding: 0.3 });
			// --- AKHIR TAMBAHAN ---
			// 2. Tentukan Opsi Peta
			if (mode === "cartesian") {
				// Ambil opsi dari file cartesian-crs.js
				mapOptions = getCartesianMapOptions();
				mapOptions.center = centerCoords || [0, 0];
			} else {
				// Mode 'geo' (default)
				lastGeoCoords = centerCoords || lastGeoCoords; // Simpan koordinat geo terakhir
				mapOptions = {
					center: lastGeoCoords,
					zoom: 14,
					zoomControl: false,
					maxNativeZoom: 19,
					maxZoom: 22,
					fadeAnimation: false,
				};
			}

			// 3. Buat ulang Peta
			map = L.map("map", mapOptions);
			window.map = map; // Ekspor kembali ke global

			// 4. Tambahkan Layer & Kontrol yang Sesuai
			if (mode === "cartesian") {
				// Tambahkan layer Kartesius (grid/gambar)
				cartesianLayerGroup = createCartesianLayers();
				cartesianLayerGroup.addTo(map);

				// Tambahkan kontrol zoom
				L.control.zoom({ position: "bottomright" }).addTo(map);
				// (Kita tidak menambahkan skala atau atribusi untuk peta non-geo)
			} else {
				// Tambahkan layer 'geo' (satelit)
				satelliteLayer = L.tileLayer(
					"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
					{
						maxNativeZoom: 19,
						maxZoom: 22,
						attribution: "Tiles © Esri",
					}
				);
				satelliteLayer.on("tileerror", function (event) {
					console.error("Tile load error:", event);
					showNotification(
						"Failed to load map data. Check your internet connection.",
						true
					);
					satelliteLayer.off("tileerror");
				});
				satelliteLayer.addTo(map);

				// Tambahkan semua kontrol geo
				L.control
					.scale({ imperial: false, position: "bottomright" })
					.addTo(map);
				L.control.zoom({ position: "bottomright" }).addTo(map);
				const creditHTML =
					`<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a> · ` +
					`<span title="Author">Credit by <a href="https://id.linkedin.com/in/virdanurlulu" target="_blank" rel="nofollow noopener">Virda Nur Lu'lu</a></span>`;
				map.attributionControl.setPrefix(creditHTML);
			}

			// 5. Tambahkan Kontrol Kustom (Legenda & Marker)
			new L.Control.Legend().addTo(map);
			centerMarker = null; // Reset marker
		}

		// --- TAMBAHKAN FUNGSI SWITCHER GLOBAL ---
		window.switchToCartesianMap = () => {
			if (currentMapMode !== "cartesian") {
				initializeMap("cartesian", [0, 0]);

				// --- PERBAIKAN BUG 4 ---
				// Sembunyikan HANYA input koordinat, BUKAN seluruh kontrol
				document.querySelector(".coord-inputs").style.display = "none";
				document.getElementById("mapControls").style.justifyContent =
					"flex-end"; // Ratakan ke kanan
				// --- AKHIR PERBAIKAN ---

				document.getElementById("map-color-legend-container").style.display =
					"none";
				if (mapTitleEl) mapTitleEl.textContent = "Cartesian View (X/Y)";
			}
		};

		window.switchToGeoMap = (coords) => {
			if (currentMapMode !== "geo") {
				initializeMap("geo", coords);

				// --- PERBAIKAN BUG 4 ---
				// Tampilkan kembali semua kontrol
				document.getElementById("mapControls").style.display = "flex";
				document.getElementById("mapControls").style.justifyContent =
					"space-between";
				document.querySelector(".coord-inputs").style.display = "flex";
				// --- AKHIR PERBAIKAN ---
			}
			// Jika sudah geo, cukup pindah view
			if (map) {
				const currentCenter = map.getCenter();
				const newCenter = L.latLng(coords); // Konversi array [lat, lon] ke objek LatLng Leaflet

				// Cek jika pusatnya berbeda (dengan toleransi 1 meter)
				if (currentCenter.distanceTo(newCenter) > 1) {
					map.setView(newCenter, 14);
				}
			}
		};

		// --- INI FUNGSI init() BARU YANG SUDAH DISESUAIKAN ---
		(function init() {
			mapTitleEl = document.getElementById("mapTitle");
			setHeading(null);

			// 1. Buat Peta Geo awal
			initializeMap("geo", [settings.lat, settings.lon]);

			// 2. Lanjutkan dengan logika lama (sekarang aman)
			refreshPlaceName(settings.lat, settings.lon);
			setFSLabel(false);
			updateCoordInputs();
			if (poModelSelect) poModelSelect.value = settings.poModel;
			updateMapFromLog();

			setTimeout(() => {
				const firstRow = document.querySelector(
					"#logTbody tr:not(.log-placeholder)"
				);
				if (firstRow) {
					firstRow.click();
				}
			}, 100);
		})();
		// Listen for custom events from the other script for CSV import
		window.addEventListener("map:updateCoords", (e) => {
			const { lat, lon } = e.detail;
			settings.lat = lat;
			settings.lon = lon;
			savePartial({ lat, lon });
			updateCoordInputs();
			isProgrammaticMove = true;
			map.setView([lat, lon]);
			refreshPlaceName(lat, lon).then(() => {
				drawInitialState();
			});
		});

		window.addEventListener("map:updatePoModel", (e) => {
			const { model } = e.detail;
			settings.poModel = model;
			if (poModelSelect) poModelSelect.value = model;
			savePartial({ poModel: model });
			updateMapFromLog(); // Redraw map with new model selection
		});

		async function updateMapFromLog() {
			if (
				typeof simulationLog === "undefined" ||
				!Array.isArray(simulationLog)
			) {
				console.error("simulationLog array not found or not an array.");
				return;
			}
			let settingsChanged = false;

			// Secara otomatis menyinkronkan kontrol peta dengan entri pertama dalam log simulasi.
			if (simulationLog.length > 0) {
				const firstLog = simulationLog[0];
				const lat = parseFloat(firstLog.lat);
				const lon = parseFloat(firstLog.lon);
				const poModel = firstLog.poModel;

				// Menyinkronkan koordinat
				// --- PERBAIKAN BUG 1 & 3 ---
				if (isNaN(lat) || isNaN(lon)) {
					// KASUS KARTESIUS (LAT/LON NULL)
					window.switchToCartesianMap();
					// JANGAN panggil refreshPlaceName
					// JANGAN set settingsChanged = true (agar tidak menyimpan status korup)
				} else {
					// KASUS GEO (LAT/LON VALID)
					window.switchToGeoMap([lat, lon]);

					if (settings.lat !== lat || settings.lon !== lon) {
						settings.lat = lat;
						settings.lon = lon;
						settingsChanged = true; // HANYA set true jika geo
					}
					updateCoordInputs();
					await refreshPlaceName(settings.lat, settings.lon); // HANYA panggil di mode geo
				}

				// Menyinkronkan Po Model
				// const poModelSelect = document.getElementById("poModelSelect");
				// if (poModel && poModelSelect && settings.poModel !== poModel) {
				// 	settings.poModel = poModel;
				// 	poModelSelect.value = poModel; // Memperbarui UI dropdown
				// 	settingsChanged = true;
				// }

				if (settingsChanged) {
					savePartial({
						lat: settings.lat,
						lon: settings.lon,
						poModel: settings.poModel,
					});
				}
			}

			//await refreshPlaceName(settings.lat, settings.lon);

			const poModelSelect = document.getElementById("poModelSelect");
			const selectedModel = poModelSelect
				? poModelSelect.value
				: settings.poModel || "crowl";
			const modelKeyMap = {
				crowl: "po_crowl",
				alonso: "po_alonso",
				sadovski: "po_sadovski",
			};
			const pressureKey = modelKeyMap[selectedModel] || "po_crowl";

			const csvLines = simulationLog
				.map((logEntry) => {
					const distance = parseFloat(logEntry.dist);
					if (!isNaN(distance) && distance > 0) {
						const pressure = logEntry[pressureKey]
							? parseFloat(logEntry[pressureKey])
							: NaN;
						// Format CSV line: "distance, pressure". Pressure is optional.
						return isNaN(pressure) ? `${distance}` : `${distance}, ${pressure}`;
					}
					return null; // Return null for invalid entries
				})
				.filter(Boolean); // Filter out null values

			const newCsv = csvLines.join("\n");

			if (newCsv !== settings.csv || (newCsv && !finalLayer)) {
				settings.csv = newCsv;

				if (csvLines.length === 0) {
					rings = []; // Clear ring data
					clearLayers(); // Remove all layers from the map
					ensureCenterMarker(settings.lat, settings.lon, placeName); // Redraw the center marker
				} else {
					drawInitialState();
				}
			}
		}

		const logTbodyObserver = document.getElementById("logTbody");
		if (logTbodyObserver) {
			const observer = new MutationObserver(() => {
				// Gunakan debounce untuk menunda eksekusi agar tidak berjalan berkali-kali
				clearTimeout(window.logUpdateTimeout);
				window.logUpdateTimeout = setTimeout(updateMapFromLog, 250);
			});
			observer.observe(logTbodyObserver, { childList: true });
		}
		const leftPanel = document.querySelector(".left");
		const rightPanel = document.querySelector(".right");
		const logSection = document.querySelector(
			'section[aria-labelledby="log-head"]'
		);
		const overpressureChartSection = document.querySelector(
			'section[aria-labelledby="overpressure-chart-head"]'
		);
		function adjustLogPosition() {
			const leftPanel = document.querySelector(".left");
			const rightPanel = document.querySelector(".right");
			const logSection = document.querySelector(
				'section[aria-labelledby="log-head"]'
			);
			const overpressureChartSection = document.querySelector(
				'section[aria-labelledby="overpressure-chart-head"]'
			);
			const contourMapSection = document.querySelector(
				'section[aria-labelledby="contour-map-head"]'
			);

			// ---> TAMBAHKAN CEK INI DI AWAL <---
			if (
				!leftPanel ||
				!rightPanel ||
				!logSection ||
				!overpressureChartSection ||
				!contourMapSection
			) {
				// Jika salah satu elemen layout utama tidak ada (misal di flow-process.html),
				// hentikan fungsi ini agar tidak error.
				// console.log("adjustLogPosition: Missing required layout elements, skipping adjustment."); // Opsional log
				return;
			}
			// ---> AKHIR CEK <---

			const sliderSections = [
				document.getElementById("gangneungSliderContainer"),
				document.getElementById("beirutSliderContainer"),
				document.getElementById("tianjinSliderContainer"),
				document.getElementById("wenlingSliderContainer"),
				document.getElementById("sanjuanicoSliderContainer"),
				document.getElementById("experimentSliderContainer"),
			].filter((el) => el != null);

			if (window.innerWidth <= 1024) {
				// === LOGIKA MOBILE ===
				if (!leftPanel.contains(logSection)) {
					overpressureChartSection.insertAdjacentElement(
						"afterend",
						logSection
					);
				}
				let lastMovedElement = contourMapSection;
				sliderSections.forEach((slider) => {
					if (!leftPanel.contains(slider)) {
						lastMovedElement.insertAdjacentElement("afterend", slider);
						lastMovedElement = slider;
					}
				});
			} else {
				// === LOGIKA DESKTOP ===
				if (!rightPanel.contains(logSection)) {
					const firstSliderInRight = rightPanel.querySelector(
						'section[id$="SliderContainer"]'
					);
					if (firstSliderInRight) {
						rightPanel.insertBefore(logSection, firstSliderInRight);
					} else {
						rightPanel.appendChild(logSection);
					}
				}
				sliderSections.forEach((slider) => {
					if (!rightPanel.contains(slider)) {
						rightPanel.appendChild(slider);
					}
				});
			}
		}
		adjustLogPosition();
		const debouncedAdjustLogPosition = debounce(adjustLogPosition, 150);
		window.addEventListener("resize", debouncedAdjustLogPosition);
		window.addEventListener("orientationchange", debouncedAdjustLogPosition);
	});
	// Helper function to load scripts sequentially and avoid race conditions
	function loadScript(src) {
		return new Promise((resolve, reject) => {
			// Check if the script already exists to avoid re-loading
			if (document.querySelector(`script[src="${src}"]`)) {
				resolve();
				return;
			}
			const script = document.createElement("script");
			script.src = src;
			script.async = true; // Still allow async download, but execution order is controlled by await
			script.onload = () => resolve();
			script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
			document.head.appendChild(script);
		});
	}

	// Coba muat Leaflet dan Cartesian-CRS secara sekuensial
	try {
		// 1. Muat Leaflet dan TUNGGU hingga selesai
		if (typeof L === "undefined") {
			await loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");
		}

		// 2. SETELAH Leaflet ada, muat skrip Cartesian Anda dan TUNGGU
		await loadScript("/js/cartesian-crs.js");
	} catch (e) {
		console.error("Gagal memuat skrip peta (Leaflet atau Cartesian):", e);
		mapContainer.innerHTML =
			'<p style="padding: 20px; text-align: center; color: var(--danger); font-weight: bold;">Kesalahan: Gagal memuat pustaka peta.</p>';
		return; // Hentikan eksekusi jika library penting gagal
	}

	// Periksa apakah 'L' (dari Leaflet) berhasil dimuat
	if (typeof L === "undefined") {
		console.error(
			"Pustaka Leaflet tidak dimuat. Peta tidak dapat diinisialisasi."
		);

		const mapCard = document.getElementById("mapCard");
		if (mapContainer) {
			mapContainer.innerHTML =
				'<p style="padding: 20px; text-align: center; color: var(--danger); font-weight: bold;">Kesalahan: Gagal memuat pustaka peta. Harap periksa koneksi internet Anda dan coba muat ulang halaman.</p>';
		}
		// Sembunyikan kontrol yang tidak relevan jika peta gagal dimuat
		const controls = document.getElementById("mapControls");
		if (controls) controls.style.display = "none";
		if (mapCard) mapCard.style.backgroundColor = "var(--bg)";
		return; // Hentikan eksekusi skrip peta
	}

	const LS_KEY = "explosionContour:v1";
	const RG_KEY = "explosionContour:revgeo:v2";

	let notifTimer = null;
	function showNotification(message, isError = false) {
		const el = document.getElementById("notification");
		el.textContent = message;
		el.className = "notification"; // reset
		if (isError) el.classList.add("error");
		el.classList.add("show");
		if (notifTimer) clearTimeout(notifTimer);
		notifTimer = setTimeout(() => {
			el.classList.remove("show");
		}, 4000);
	}

	// --- TAMBAHKAN FUNGSI INI ---
	/**
	 * Mengubah warna hex menjadi string rgba dengan opacity.
	 * @param {string} hex - Kode warna hex (misal, "#FF0000").
	 * @param {number} opacity - Nilai transparansi (0.0 hingga 1.0).
	 * @returns {string} - String "rgba(r, g, b, a)"
	 */
	function hexToRgba(hex, opacity) {
		let r = 0,
			g = 0,
			b = 0;
		// Handle 3 digit hex
		if (hex.length === 4) {
			r = parseInt(hex[1] + hex[1], 16);
			g = parseInt(hex[2] + hex[2], 16);
			b = parseInt(hex[3] + hex[3], 16);
		}
		// Handle 6 digit hex
		else if (hex.length === 7) {
			r = parseInt(hex.substring(1, 3), 16);
			g = parseInt(hex.substring(3, 5), 16);
			b = parseInt(hex.substring(5, 7), 16);
		}
		return `rgba(${r}, ${g}, ${b}, ${opacity})`;
	}
	// --- AKHIR TAMBAHAN ---

	// --- TAMBAHKAN FUNGSI BARU INI ---
	/**
	 * Membuat array layer poligon "donut" (annulus) yang tidak tumpang tindih.
	 */
	function createContourPolygons(
		ringsData,
		palette,
		lat,
		lon,
		np,
		weight,
		opacity
	) {
		// ringsData adalah array [ {r: 300, Po: ...}, {r: 400, Po: ...}, ... ]

		return ringsData.map((d, i) => {
			const color = palette[i % palette.length];

			// Buat koordinat untuk lingkar terluar dari zona ini
			const outerCoords = circleCoordsGeodesic(lat, lon, d.r, np);

			let polygonCoords;

			if (i === 0) {
				// Ini adalah lingkaran paling tengah (paling kecil)
				// Ini adalah poligon solid, bukan donat.
				polygonCoords = outerCoords;
			} else {
				// Ini adalah "donat".
				// Kita perlu membuat "lubang" menggunakan radius dari zona sebelumnya.
				const innerRadius = ringsData[i - 1].r;
				const innerCoords = circleCoordsGeodesic(lat, lon, innerRadius, np);

				// Format Leaflet untuk poligon dengan lubang:
				// [ [koordinat_luar], [koordinat_dalam_dibalik] ]
				polygonCoords = [outerCoords, innerCoords.reverse()];
			}

			return L.polygon(polygonCoords, {
				renderer: canvasRenderer,
				color: "#000000",
				weight: weight,
				fillColor: color, // Warna hex murni
				fillOpacity: opacity, // Opacity diterapkan di sini
												}).bindPopup(
													`<b>r = ${d.r} m</b>${
														d.Po != null
															? `<br>Po: <code>${Number(d.Po).toFixed(3)}</code>`
															: ""
													}`
												);		});
	}

	function createCartesianCircles(ringsData, palette, weight, opacity) {
		// ringsData sudah diurutkan dari kecil ke besar
		return ringsData
			.map((d, i) => {
				const color = palette[i % palette.length];
				// L.circle() secara otomatis menggunakan 'meter' di L.CRS.Cartesian
				return L.circle([0, 0], {
					// [Y, X] center, selalu [0,0]
					radius: d.r, // Radius dalam 'meter' (unit CRS)
					renderer: canvasRenderer,
					color: "#000000",
					weight: weight,
					fillColor: color,
					fillOpacity: opacity,
				}).bindPopup(
					`<b>r = ${d.r} m</b>${
						d.Po != null
							? `<br>Po: <code>${Number(d.Po).toFixed(3)}</code>`
							: ""
					}`
				);
			})
			.reverse(); // Balik urutan agar lingkaran terbesar digambar dulu
	}
	// ======= QS read-only =======
	function b64urlToStr(b64u) {
		try {
			const b64 =
				b64u.replace(/-/g, "+").replace(/_/g, "/") +
				"===".slice(b64u.length % 4);
			const bin = atob(b64);
			const bytes = new Uint8Array(bin.length);
			for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
			return new TextDecoder().decode(bytes);
		} catch {
			return "";
		}
	}
	function readFromQS() {
		const sp = new URLSearchParams(location.search);
		if (!sp || [...sp].length === 0) return {};
		const obj = {};
		if (sp.has("lat")) obj.lat = parseNumberLoose(sp.get("lat"));
		if (sp.has("lon")) obj.lon = parseNumberLoose(sp.get("lon"));
		if (sp.has("np"))
			obj.np = Math.max(16, Math.min(360, parseInt(sp.get("np"), 10) || 0));
		if (sp.has("iv")) obj.iv = Math.max(0, parseInt(sp.get("iv"), 10) || 0);
		if (sp.has("os"))
			obj.os = Math.max(0, Math.min(1, parseNumberLoose(sp.get("os"))));
		if (sp.has("of"))
			obj.of = Math.max(0, Math.min(1, parseNumberLoose(sp.get("of"))));
		if (sp.has("sw")) obj.sw = Math.max(0, parseNumberLoose(sp.get("sw")));
		if (sp.has("pal")) {
			const v = sp.get("pal").toLowerCase();
			if (["bright", "cerah", "default"].includes(v)) obj.pal = "bright";
			else if (["bluegreen", "biru-hijau", "biru", "hijau", "bg"].includes(v))
				obj.pal = "bluegreen";
			else if (["heat", "panas"].includes(v)) obj.pal = "heat";
		}
		if (sp.has("label")) {
			const v = sp.get("label").toLowerCase();
			obj.showLabel = !(
				v === "0" ||
				v === "false" ||
				v === "no" ||
				v === "off"
			);
		}
		if (sp.has("csvb64")) {
			const s = b64urlToStr(sp.get("csvb64") || "");
			if (s) obj.csv = s;
		} else if (sp.has("csv")) {
			let v = sp.get("csv") || "";
			obj.csv = v.replace(/\|/g, "\n").replace(/;/g, "\n");
		}
		return Object.fromEntries(
			Object.entries(obj).filter(
				([, v]) => v !== undefined && v !== null && v !== ""
			)
		);
	}

	// ======= localStorage =======
	function loadSaved() {
		try {
			const o = JSON.parse(localStorage.getItem(LS_KEY) || "null");
			return o && typeof o === "object" ? o : {};
		} catch {
			return {};
		}
	}
	function savePartial(patch) {
		settings = { ...settings, ...patch };
		try {
			localStorage.setItem(LS_KEY, JSON.stringify(settings));
		} catch (e) {
			console.warn("Could not save map settings to local storage:", e);
		}
	}

	// ======= Compose settings (QS ➜ LS ➜ Built-in) =======
	let settings = { ...BUILTIN_DEFAULTS, ...loadSaved(), ...readFromQS() };
	// ======= Geodesic helpers =======
	const R_EARTH = 6371008.8; // m
	function destPoint(latDeg, lonDeg, distanceM, bearingDeg) {
		const φ1 = (latDeg * Math.PI) / 180,
			λ1 = (lonDeg * Math.PI) / 180;
		const θ = (bearingDeg * Math.PI) / 180,
			δ = distanceM / R_EARTH;
		const sinφ1 = Math.sin(φ1),
			cosφ1 = Math.cos(φ1);
		const sinδ = Math.sin(δ),
			cosδ = Math.cos(δ);
		const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
		const φ2 = Math.asin(sinφ2);
		const y = Math.sin(θ) * sinδ * cosφ1,
			x = cosδ - sinφ1 * sinφ2;
		let λ2 = λ1 + Math.atan2(y, x);
		λ2 = ((λ2 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
		return [(φ2 * 180) / Math.PI, (λ2 * 180) / Math.PI];
	}
	window.destPoint = destPoint; // <-- TAMBAHKAN BARIS INI

	function circleCoordsGeodesic(lat0, lon0, Rm, n = 90) {
		const coords = [];
		for (let i = 0; i <= n; i++) {
			const bearing = (360 * i) / n;
			const [lat, lon] = destPoint(lat0, lon0, Rm, bearing);
			coords.push([lat, lon]);
		}
		return coords;
	}
	L.Control.Legend = L.Control.extend({
		options: {
			position: "bottomleft", // Menentukan posisi di kiri bawah
		},
		onAdd: function (map) {
			// Buat div utama untuk legenda
			const div = L.DomUtil.create("div", "leaflet-control-legend-wrapper");

			// Beri ID unik agar mudah ditemukan oleh fungsi lain
			div.id = "map-color-legend-container";

			// Beri style dasar (kotak putih transparan)
			div.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
			div.style.padding = "10px";
			div.style.borderRadius = "5px";
			div.style.boxShadow = "0 1px 5px rgba(0,0,0,0.4)";
			div.style.display = "none"; // Sembunyikan saat pertama dibuat
			div.style.maxWidth = "200px"; // Batasi lebar
			div.style.display = "none"; // Sembunyikan saat pertama dibuat

			// Hentikan event klik agar tidak 'jatuh' ke peta
			L.DomEvent.disableClickPropagation(div);
			L.DomEvent.disableScrollPropagation(div);

			return div;
		},
	});
	// ======= Map init =======
	// const map = L.map("map", {
	// 	center: [settings.lat, settings.lon],
	// 	zoom: 14,
	// 	zoomControl: false,
	// 	maxNativeZoom: 19,
	// 	maxZoom: 22,
	// });
	// new L.Control.Legend().addTo(map); // Membuat dan menambahkan kontrol legenda baru
	// window.map = map; // <-- TAMBAHKAN BARIS INI

	// const canvasRenderer = L.canvas({ padding: 0.3 });

	// const satelliteLayer = L.tileLayer(
	// 	"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
	// 	{
	// 		maxNativeZoom: 19,
	// 		maxZoom: 22,
	// 		attribution: "Tiles © Esri",
	// 	}
	// );

	// satelliteLayer.on("tileerror", function (event) {
	// 	console.error("Tile load error:", event);
	// 	showNotification(
	// 		"Failed to load map data. Check your internet connection.",
	// 		true
	// 	);
	// 	satelliteLayer.off("tileerror");
	// });
	// satelliteLayer.addTo(map);

	// L.control.scale({ imperial: false, position: "bottomright" }).addTo(map);
	// L.control.zoom({ position: "bottomright" }).addTo(map);
	// const creditHTML =
	// 	`<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a> · ` +
	// 	`<span title="Author">Credit by <a href="https://id.linkedin.com/in/virdanurlulu" target="_blank" rel="nofollow noopener">Virda Nur Lu'lu</a></span>`;
	// map.attributionControl.setPrefix(creditHTML);

	// ======= Palettes =======
	const palettes = {
		bright: [
			"#FF0000",
			"#FFA500",
			"#FFFF00",
			"#00FF00",
			"#00FFFF",
			"#0000FF",
			"#FF00FF",
			"#800080",
			"#FFC0CB",
			"#A52A2A",
		],
		bluegreen: [
			"#203a8f",
			"#2d6cdf",
			"#3fb6ff",
			"#27c3a4",
			"#15a371",
			"#0f7a54",
			"#0b533b",
			"#083b2c",
		],
		heat: [
			"#4b0d0d",
			"#7a1f0e",
			"#ad3510",
			"#e65a0d",
			"#ff8c00",
			"#ffb200",
			"#ffd000",
			"#ffe680",
		],
	};

	// ======= Reverse Geocoding (Latin/EN, cache, fallback) =======
	function esc(s) {
		return String(s || "").replace(
			/[&<>"']/g,
			(m) =>
				({ "&": "&amp;", "<": "&lt;", ">": "gt;", '"': "&quot;", "'": "&#39;" }[
					m
				])
		);
	}
	function isRTL(str) {
		return /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(str);
	}
	function rgKey(lat, lon) {
		return `${lat.toFixed(5)},${lon.toFixed(5)}`;
	}
	function rgLoadCache() {
		try {
			return JSON.parse(localStorage.getItem(RG_KEY) || "{}");
		} catch {
			return {};
		}
	}
	function rgSaveCache(obj) {
		try {
			localStorage.setItem(RG_KEY, JSON.stringify(obj));
		} catch {}
	}

	let isProgrammaticMove = false; // Flag to prevent moveend recursion
	async function reverseGeocode(lat, lon) {
		const key = rgKey(lat, lon);
		const cache = rgLoadCache();
		const TTL = 30 * 24 * 3600 * 1000; // 30 days
		if (cache[key] && Date.now() - cache[key].ts < TTL) return cache[key].name;

		try {
			// Call our new proxy function, which handles fallbacks internally
			const r = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`);
			if (!r.ok) {
				const errData = await r
					.json()
					.catch(() => ({ error: "Geocoding proxy failed" }));
				throw new Error(
					errData.error || `Geocoding proxy failed with status ${r.status}`
				);
			}
			const j = await r.json();

			let name = "";
			// Logic to handle response from either Nominatim or Open-Meteo
			if (j.address) {
				// This looks like a Nominatim response
				const a = j.address;
				const city = a.city || a.town || a.village || a.hamlet;
				const country = a.country || "";
				name = [city, country].filter(Boolean).join(", ");
			} else if (j.results && j.results.length > 0) {
				// This looks like an Open-Meteo response
				const g = j.results[0];
				name = [g.name, g.country].filter(Boolean).join(", ");
			}

			if (name && !isRTL(name)) {
				cache[key] = { name, ts: Date.now() };
				rgSaveCache(cache);
				return name;
			}
			return ""; // Return empty string if no name could be parsed
		} catch (e) {
			console.error("Geocoding proxy fetch failed:", e);
			showNotification(
				"Failed to get location name. Check your internet connection or local server.",
				true
			);
			return "";
		}
	}

	let centerMarker = null;
	let placeName = "";
	let mapTitleEl = null;

	// ======= Heading updater =======
	function setHeading(name) {
		const label =
			name && name.trim()
				? name.trim()
				: `${settings.lat.toFixed(5)}, ${settings.lon.toFixed(5)}`;
		const txt = `${label}`;
		document.title = txt;
		if (mapTitleEl) mapTitleEl.textContent = txt;
	}

	function _attachTooltipCloseHandler(tooltip) {
		if (!tooltip || !tooltip._container) return;
		const closeBtn = tooltip._container.querySelector(".placelabel-close");
		if (closeBtn) {
			L.DomEvent.on(closeBtn, "click", (event) => {
				L.DomEvent.stop(event);
				if (centerMarker) centerMarker.closeTooltip();
			});
		}
	}

	function ensureCenterMarker(lat, lon, name) {
		if (currentMapMode === "cartesian") {
			// Jika di mode Kartesius, hapus marker jika ada, dan jangan buat yang baru
			if (centerMarker) {
				centerMarker.remove(); // Hapus dari peta
				centerMarker = null; // Hapus referensi
			}
			return; // Hentikan fungsi
		}

		const pinIcon = L.divIcon({
			html: `<i class='fas' style='font-size:24px; color:red;'>&#xf276;</i>`,
			className: "custom-div-icon",
			iconSize: [24, 24],
			iconAnchor: [7, 24],
			popupAnchor: [0, -24],
		});

		if (!centerMarker) {
			centerMarker = L.marker([lat, lon], { icon: pinIcon }).addTo(map); // <--- GANTI JADI INI

			centerMarker.on("tooltipopen", function (e) {
				_attachTooltipCloseHandler(e.tooltip);
			});
		} else {
			centerMarker.setLatLng([lat, lon]);
		}

		// Tooltip for center marker is disabled as per user request.
		// The location name is already shown in the top-left title.
		if (centerMarker.getTooltip()) {
			centerMarker.unbindTooltip();
		}
	}
	async function refreshPlaceName(lat, lon) {
		placeName = await reverseGeocode(lat, lon);
		ensureCenterMarker(lat, lon, placeName);
		setHeading(placeName);
		if (!document.getElementById("legend").hidden) refreshLegend();
	}

	// ======= Animation =======
	const RESPECT_REDUCED_MOTION =
		window.matchMedia &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	let rings = parseData(settings.csv);
	let tempLayers = [],
		finalLayer = null,
		idx = 0,
		playing = false,
		finished = false,
		timer = null;

	function clearLayers() {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		tempLayers.forEach((l) => map.removeLayer(l));
		tempLayers = [];
		if (finalLayer) {
			map.removeLayer(finalLayer);
			finalLayer = null;
		}
		const toRemove = [];
		map.eachLayer((l) => {
			if (l instanceof L.Polygon || l instanceof L.GeoJSON) {
				toRemove.push(l);
			}
		});
		toRemove.forEach((l) => map.removeLayer(l));

		// --- LOGIKA BARU UNTUK KONTROL KITA ---
		// Sembunyikan legenda kustom kita
		const leg = document.getElementById("map-color-legend-container");
		if (leg) {
			leg.innerHTML = "";
			leg.style.display = "none";
		}

		// Sembunyikan juga legenda lama (jika masih ada)
		const oldLeg = document.getElementById("legend");
		if (oldLeg) oldLeg.hidden = true;
	}
	function refreshLegend() {
		const leg = document.getElementById("map-color-legend-container");
		if (!leg) return;

		const pal = palettes[settings.pal] || palettes.bright;

		let html = `<b style="font-size: 14px; display: block; margin-bottom: 5px;">${translateKey(
			"legend_title_radius",
			"Zona Radius" // Fallback
		)}</b>`;

		rings.forEach((ring, i) => {
			const color = pal[i % pal.length]; // Warna hex murni, misal "#FF0000"

			// --- AWAL PERUBAHAN ---
			// Ubah hex murni menjadi RGBA dengan opacity dari settings
			const rgbaColor = hexToRgba(color, settings.of);
			// --- AKHIR PERUBAHAN ---

			const poLabel =
				ring.Po != null ? `(Po: ${Number(ring.Po).toFixed(3)})` : "";
			const label = `${ring.r} m ${poLabel}`;

			html += `
            <div style="display: flex; align-items: center; margin-top: 5px;">
                <span style="
                             /* --- GUNAKAN WARNA RGBA DI SINI --- */
                             background-color: ${rgbaColor}; 
                             
                             width: 25px; 
                             height: 15px; 
                             border: 1px solid #333; 
                             margin-right: 8px; 
                             display: inline-block;
                             flex-shrink: 0;">
                </span>
                <span style="font-size: 13px;">${label}</span>
            </div>
        `;
		});

		leg.innerHTML = html;
		leg.style.display = "block";

		const oldLeg = document.getElementById("legend");
		if (oldLeg) oldLeg.hidden = true;
	}

	function drawStep() {
		if (!playing) return;
		const ivUsed = RESPECT_REDUCED_MOTION ? 0 : Math.max(0, settings.iv | 0);
		if (idx < rings.length) {
			const d = rings[idx];
			const pal = palettes[settings.pal] || palettes.bright;
			let layer;

			// --- AWAL PERBAIKAN BUG 2 (ANIMASI) ---
			if (currentMapMode === "cartesian") {
				layer = L.circle([0, 0], {
					radius: d.r,
					renderer: canvasRenderer,
					color: "#000000",
					weight: settings.sw,
					fillColor: pal[idx % pal.length],
					fillOpacity: settings.os, // Opacity animasi
				})
					.bindPopup(
						`<b>r = ${d.r} m</b>${
							d.Po != null ? `<br>Po: <code>${d.Po}</code>` : ""
						}`
					)
					.addTo(map);
				if (idx === 0) {
					try {
						map.setView([0, 0], -3);
					} catch (e) {}
				}
			} else {
				// Logika Geo yang sudah ada
				const coords = circleCoordsGeodesic(
					settings.lat,
					settings.lon,
					d.r,
					settings.np
				);
				layer = L.polygon(coords, {
					renderer: canvasRenderer,
					color: "#000000",
					weight: settings.sw,
					fillColor: pal[idx % pal.length],
					fillOpacity: settings.os,
				})
					.bindPopup(
						`<b>r = ${d.r} m</b>${
							d.Po != null ? `<br>Po: <code>${d.Po}</code>` : ""
						}`
					)
					.addTo(map);
				if (idx === 0) {
					try {
						map.setView([settings.lat, settings.lon], 14);
					} catch (e) {}
				}
			}
			// --- AKHIR PERBAIKAN ---

			tempLayers.push(layer);
			idx++;
			timer = setTimeout(drawStep, ivUsed);
		} else {
			// Frame terakhir animasi (blok 'else')
			tempLayers.forEach((l) => map.removeLayer(l));
			tempLayers = [];
			const pal = palettes[settings.pal] || palettes.bright;

			// --- AWAL PERBAIKAN BUG 2 (FRAME TERAKHIR) ---
			let polygons = [];
			if (currentMapMode === "cartesian") {
				polygons = createCartesianCircles(rings, pal, settings.sw, settings.of);
			} else {
				polygons = createContourPolygons(
					rings,
					pal,
					settings.lat,
					settings.lon,
					settings.np,
					settings.sw,
					settings.of
				);
			}
			finalLayer = L.featureGroup(polygons).addTo(map);
			// --- AKHIR PERBAIKAN ---

			try {
				if (currentMapMode === "cartesian") {
					map.setView([0, 0], -3);
				} else {
					map.fitBounds(finalLayer.getBounds(), { padding: [20, 20] });
				}
			} catch (e) {}
			refreshLegend();
			playing = false;
			finished = true;
		}
	}

	function drawInitialState() {
		clearLayers();
		finished = true;
		playing = false;
		rings = parseData(settings.csv);

		const pal = palettes[settings.pal] || palettes.bright;

		let polygons = [];
		if (currentMapMode === "cartesian") {
			// Panggil fungsi Kartesius (menggunakan L.circle)
			polygons = createCartesianCircles(
				rings,
				pal,
				settings.sw,
				settings.of // Gunakan opacity final
			);
		} else {
			// Panggil fungsi Geo (menggunakan 'donat')
			polygons = createContourPolygons(
				rings,
				pal,
				settings.lat,
				settings.lon,
				settings.np,
				settings.sw,
				settings.of // Gunakan opacity final
			);
		}

		finalLayer = L.featureGroup(polygons).addTo(map);
		// --- AKHIR PERBAIKAN ---
		try {
			if (finalLayer && finalLayer.getLayers().length > 0) {
				isProgrammaticMove = true;
				map.fitBounds(finalLayer.getBounds(), { padding: [20, 20] });
			} else {
				isProgrammaticMove = true;
				map.setView([settings.lat, settings.lon], 14);
			}
		} catch (e) {
			// --- TAMBAHKAN INI ---
			console.error("FATAL ERROR in drawInitialState:", e);
			showNotification("Error: Gagal menggambar radius di peta.", true);
			// --- AKHIR TAMBAHAN ---
		}

		// --- LOGIKA BARU UNTUK KONTROL KITA ---
		if (rings.length > 0) {
			refreshLegend(); // Panggil fungsi baru kita untuk mengisi & menampilkan legenda
		} else {
			// Sembunyikan legenda kustom kita
			const leg = document.getElementById("map-color-legend-container");
			if (leg) {
				leg.innerHTML = "";
				leg.style.display = "none";
			}

			// Sembunyikan legenda lama jika masih ada
			const oldLeg = document.getElementById("legend");
			if (oldLeg) oldLeg.hidden = true;

			ensureCenterMarker(settings.lat, settings.lon, placeName);
		}
	}

	function play() {
		if (finished) {
			replay();
			return;
		}
		if (playing) return;
		playing = true;
		drawStep();
	}
	function pause() {
		playing = false;
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
	}
	function replay() {
		pause();
		clearLayers();
		idx = 0;
		finished = false;
		rings = parseData(settings.csv);
		play();
	}

	// ======= Fullscreen (desktop & mobile) =======
	const fsBtn = document.getElementById("fsBtn"),
		fsBtnMobile = document.getElementById("fsBtnMobile"),
		mapCard = document.getElementById("mapCard");

	function setFSLabel(on) {
		const txt = on ? "⛶ Exit Fullscreen" : "⛶ Fullscreen";
		[fsBtn, fsBtnMobile].forEach((b) => {
			if (!b) return;
			b.textContent = txt;
			b.setAttribute("aria-pressed", on ? "true" : "false");
		});
	}
	function enterFS() {
		mapCard.classList.add("fullscreen");
		document.body.classList.add("fs-lock");
		if (mapCard.requestFullscreen) {
			mapCard.requestFullscreen().catch(() => {});
		} else if (mapCard.webkitRequestFullscreen) {
			mapCard.webkitRequestFullscreen();
		}
		setFSLabel(true);
		setTimeout(() => map.invalidateSize(), 180);
	}
	function exitFS() {
		mapCard.classList.remove("fullscreen");
		document.body.classList.remove("fs-lock");
		if (document.fullscreenElement && document.exitFullscreen) {
			document.exitFullscreen().catch(() => {});
		} else if (
			document.webkitFullscreenElement &&
			document.webkitCancelFullScreen
		) {
			document.webkitCancelFullScreen();
		}
		setFSLabel(false);
		setTimeout(() => map.invalidateSize(), 180);
	}
	function toggleFS() {
		mapCard.classList.contains("fullscreen") ? exitFS() : enterFS();
	}

	fsBtn?.addEventListener("click", (e) => {
		e.stopPropagation();
		toggleFS();
	});
	fsBtnMobile?.addEventListener("click", (e) => {
		e.stopPropagation();
		toggleFS();
	});

	document.addEventListener("fullscreenchange", () => {
		const active =
			!!document.fullscreenElement || mapCard.classList.contains("fullscreen");
		if (!document.fullscreenElement) {
			mapCard.classList.remove("fullscreen");
			document.body.classList.remove("fs-lock");
		}
		setFSLabel(active);
	});

	window.addEventListener("resize", () => {
		if (mapCard.classList.contains("fullscreen")) {
			clearTimeout(window.__fsRaf);
			window.__fsRaf = setTimeout(() => map.invalidateSize(), 120);
		}
	});

	// ======= Map Controls Logic =======
	const mapLatInput = document.getElementById("mapLat");
	const mapLonInput = document.getElementById("mapLon");
	const poModelSelect = document.getElementById("poModelSelect");

	function updateCoordInputs() {
		if (mapLatInput) mapLatInput.value = settings.lat.toFixed(6);
		if (mapLonInput) mapLonInput.value = settings.lon.toFixed(6);
	}

	const debouncedUpdateMapFromInput = debounce(() => {
		const latStr = mapLatInput.value.trim();
		const lonStr = mapLonInput.value.trim();

		if (latStr === "" && lonStr === "") {
			settings.lat = BUILTIN_DEFAULTS.lat;
			settings.lon = BUILTIN_DEFAULTS.lon;
			savePartial({ lat: settings.lat, lon: settings.lon });
			updateCoordInputs();
			isProgrammaticMove = true;
			map.setView([settings.lat, settings.lon]);
			refreshPlaceName(settings.lat, settings.lon).then(() => {
				drawInitialState();
			});
			showNotification("Coordinates reset to default.", false);
			return;
		}

		const lat = parseFloat(mapLatInput.value);
		const lon = parseFloat(mapLonInput.value);
		if (
			!isNaN(lat) &&
			!isNaN(lon) &&
			lat >= -90 &&
			lat <= 90 &&
			lon >= -180 &&
			lon <= 180
		) {
			// Cek jika koordinat benar-benar berubah untuk menghindari pembaruan yang tidak perlu
			if (
				Math.abs(settings.lat - lat) > 1e-7 ||
				Math.abs(settings.lon - lon) > 1e-7
			) {
				settings.lat = lat;
				settings.lon = lon;
				savePartial({ lat: lat, lon: lon });
				// Atur tampilan peta ke koordinat baru
				isProgrammaticMove = true;
				map.setView([lat, lon]);
				// Muat ulang nama tempat dan gambar ulang semuanya di lokasi baru
				refreshPlaceName(lat, lon).then(() => {
					drawInitialState();
				});
			}
		} else {
			showNotification("Invalid coordinate values.", true);
		}
	}, 750);

	if (mapLatInput)
		mapLatInput.addEventListener("input", debouncedUpdateMapFromInput);
	if (mapLonInput)
		mapLonInput.addEventListener("input", debouncedUpdateMapFromInput);
	if (poModelSelect) {
		poModelSelect.addEventListener("change", () => {
			settings.poModel = poModelSelect.value;
			//savePartial({ poModel: poModelSelect.value });
			updateMapFromLog();
			updatePsVsZeChart(); // Update chart with new Po model selection
		});
	}
	// --- TAMBAHKAN FUNGSI BARU UNTUK MENGATUR MAP ---
	/**
	 * Menghancurkan peta yang ada dan membuat ulang dengan mode yang ditentukan.
	 * @param {string} mode - 'geo' atau 'cartesian'
	 * @param {Array} centerCoords - Koordinat [lat, lon] atau [y, x]
	 */
	function initializeMap(mode, centerCoords) {
		// 1. Hancurkan peta lama jika ada
		if (map) {
			map.remove();
			map = null;
		}

		let mapOptions;
		currentMapMode = mode; // Set mode saat ini
		// --- TAMBAHKAN BARIS INI ---
		// Inisialisasi renderer untuk peta baru ini
		canvasRenderer = L.canvas({ padding: 0.3 });
		// --- AKHIR TAMBAHAN ---
		// 2. Tentukan Opsi Peta
		if (mode === "cartesian") {
			// Ambil opsi dari file cartesian-crs.js
			mapOptions = getCartesianMapOptions();
			mapOptions.center = centerCoords || [0, 0];
		} else {
			// Mode 'geo' (default)
			lastGeoCoords = centerCoords || lastGeoCoords; // Simpan koordinat geo terakhir
			mapOptions = {
				center: lastGeoCoords,
				zoom: 14,
				zoomControl: false,
				maxNativeZoom: 19,
				maxZoom: 22,
			};
		}

		// 3. Buat ulang Peta
		map = L.map("map", mapOptions);
		window.map = map; // Ekspor kembali ke global

		// 4. Tambahkan Layer & Kontrol yang Sesuai
		if (mode === "cartesian") {
			// Tambahkan layer Kartesius (grid/gambar)
			cartesianLayerGroup = createCartesianLayers();
			cartesianLayerGroup.addTo(map);

			// Tambahkan kontrol zoom
			L.control.zoom({ position: "bottomright" }).addTo(map);
			// (Kita tidak menambahkan skala atau atribusi untuk peta non-geo)
		} else {
			// Tambahkan layer 'geo' (satelit)
			satelliteLayer = L.tileLayer(
				"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
				{
					maxNativeZoom: 19,
					maxZoom: 22,
					attribution: "Tiles © Esri",
				}
			);
			satelliteLayer.on("tileerror", function (event) {
				console.error("Tile load error:", event);
				showNotification(
					"Failed to load map data. Check your internet connection.",
					true
				);
				satelliteLayer.off("tileerror");
			});
			satelliteLayer.addTo(map);

			// Tambahkan semua kontrol geo
			L.control.scale({ imperial: false, position: "bottomright" }).addTo(map);
			L.control.zoom({ position: "bottomright" }).addTo(map);
			const creditHTML =
				`<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a> · ` +
				`<span title="Author">Credit by <a href="https://id.linkedin.com/in/virdanurlulu" target="_blank" rel="nofollow noopener">Virda Nur Lu'lu</a></span>`;
			map.attributionControl.setPrefix(creditHTML);
		}

		// 5. Tambahkan Kontrol Kustom (Legenda & Marker)
		new L.Control.Legend().addTo(map);
		centerMarker = null; // Reset marker
	}

	// --- TAMBAHKAN FUNGSI SWITCHER GLOBAL ---
	window.switchToCartesianMap = () => {
		if (currentMapMode !== "cartesian") {
			initializeMap("cartesian", [0, 0]);

			// --- PERBAIKAN BUG 4 ---
			// Sembunyikan HANYA input koordinat, BUKAN seluruh kontrol
			document.querySelector(".coord-inputs").style.display = "none";
			document.getElementById("mapControls").style.justifyContent = "flex-end"; // Ratakan ke kanan
			// --- AKHIR PERBAIKAN ---

			document.getElementById("map-color-legend-container").style.display =
				"none";
			if (mapTitleEl) mapTitleEl.textContent = "Cartesian View (X/Y)";
		}
	};

	window.switchToGeoMap = (coords) => {
		if (currentMapMode !== "geo") {
			initializeMap("geo", coords);

			// --- PERBAIKAN BUG 4 ---
			// Tampilkan kembali semua kontrol
			document.getElementById("mapControls").style.display = "flex";
			document.getElementById("mapControls").style.justifyContent =
				"space-between";
			document.querySelector(".coord-inputs").style.display = "flex";
			// --- AKHIR PERBAIKAN ---
		}
		// Jika sudah geo, cukup pindah view
		if (map) {
			const currentCenter = map.getCenter();
			const newCenter = L.latLng(coords); // Konversi array [lat, lon] ke objek LatLng Leaflet

			// Cek jika pusatnya berbeda (dengan toleransi 1 meter)
			if (currentCenter.distanceTo(newCenter) > 1) {
				map.setView(newCenter, 14);
			}
		}
	};

	// --- INI FUNGSI init() BARU YANG SUDAH DISESUAIKAN ---
	(function init() {
		mapTitleEl = document.getElementById("mapTitle");
		setHeading(null);

		// 1. Buat Peta Geo awal
		initializeMap("geo", [settings.lat, settings.lon]);

		// 2. Lanjutkan dengan logika lama (sekarang aman)
		refreshPlaceName(settings.lat, settings.lon);
		setFSLabel(false);
		updateCoordInputs();
		if (poModelSelect) poModelSelect.value = settings.poModel;
		updateMapFromLog();

		setTimeout(() => {
			const firstRow = document.querySelector(
				"#logTbody tr:not(.log-placeholder)"
			);
			if (firstRow) {
				firstRow.click();
			}
		}, 100);
	})();
	// Listen for custom events from the other script for CSV import
	window.addEventListener("map:updateCoords", (e) => {
		const { lat, lon } = e.detail;
		settings.lat = lat;
		settings.lon = lon;
		savePartial({ lat, lon });
		updateCoordInputs();
		isProgrammaticMove = true;
		map.setView([lat, lon]);
		refreshPlaceName(lat, lon).then(() => {
			drawInitialState();
		});
	});

	window.addEventListener("map:updatePoModel", (e) => {
		const { model } = e.detail;
		settings.poModel = model;
		if (poModelSelect) poModelSelect.value = model;
		savePartial({ poModel: model });
		updateMapFromLog(); // Redraw map with new model selection
	});

	async function updateMapFromLog() {
		if (typeof simulationLog === "undefined" || !Array.isArray(simulationLog)) {
			console.error("simulationLog array not found or not an array.");
			return;
		}
		let settingsChanged = false;

		// Secara otomatis menyinkronkan kontrol peta dengan entri pertama dalam log simulasi.
		if (simulationLog.length > 0) {
			const firstLog = simulationLog[0];
			const lat = parseFloat(firstLog.lat);
			const lon = parseFloat(firstLog.lon);
			const poModel = firstLog.poModel;

			// Menyinkronkan koordinat
			// --- PERBAIKAN BUG 1 & 3 ---
			if (isNaN(lat) || isNaN(lon)) {
				// KASUS KARTESIUS (LAT/LON NULL)
				window.switchToCartesianMap();
				// JANGAN panggil refreshPlaceName
				// JANGAN set settingsChanged = true (agar tidak menyimpan status korup)
			} else {
				// KASUS GEO (LAT/LON VALID)
				window.switchToGeoMap([lat, lon]);

				if (settings.lat !== lat || settings.lon !== lon) {
					settings.lat = lat;
					settings.lon = lon;
					settingsChanged = true; // HANYA set true jika geo
				}
				updateCoordInputs();
				await refreshPlaceName(settings.lat, settings.lon); // HANYA panggil di mode geo
			}

			// Menyinkronkan Po Model
			// const poModelSelect = document.getElementById("poModelSelect");
			// if (poModel && poModelSelect && settings.poModel !== poModel) {
			// 	settings.poModel = poModel;
			// 	poModelSelect.value = poModel; // Memperbarui UI dropdown
			// 	settingsChanged = true;
			// }

			if (settingsChanged) {
				savePartial({
					lat: settings.lat,
					lon: settings.lon,
					poModel: settings.poModel,
				});
			}
		}

		//await refreshPlaceName(settings.lat, settings.lon);

		const poModelSelect = document.getElementById("poModelSelect");
		const selectedModel = poModelSelect
			? poModelSelect.value
			: settings.poModel || "crowl";
		const modelKeyMap = {
			crowl: "po_crowl",
			alonso: "po_alonso",
			sadovski: "po_sadovski",
		};
		const pressureKey = modelKeyMap[selectedModel] || "po_crowl";

		const csvLines = simulationLog
			.map((logEntry) => {
				const distance = parseFloat(logEntry.dist);
				if (!isNaN(distance) && distance > 0) {
					const pressure = logEntry[pressureKey]
						? parseFloat(logEntry[pressureKey])
						: NaN;
					// Format CSV line: "distance, pressure". Pressure is optional.
					return isNaN(pressure) ? `${distance}` : `${distance}, ${pressure}`;
				}
				return null; // Return null for invalid entries
			})
			.filter(Boolean); // Filter out null values

		const newCsv = csvLines.join("\n");

		if (newCsv !== settings.csv || (newCsv && !finalLayer)) {
			settings.csv = newCsv;

			if (csvLines.length === 0) {
				rings = []; // Clear ring data
				clearLayers(); // Remove all layers from the map
				ensureCenterMarker(settings.lat, settings.lon, placeName); // Redraw the center marker
			} else {
				drawInitialState();
			}
		}
	}

	const logTbodyObserver = document.getElementById("logTbody");
	if (logTbodyObserver) {
		const observer = new MutationObserver(() => {
			// Gunakan debounce untuk menunda eksekusi agar tidak berjalan berkali-kali
			clearTimeout(window.logUpdateTimeout);
			window.logUpdateTimeout = setTimeout(updateMapFromLog, 250);
		});
		observer.observe(logTbodyObserver, { childList: true });
	}
	const leftPanel = document.querySelector(".left");
	const rightPanel = document.querySelector(".right");
	const logSection = document.querySelector(
		'section[aria-labelledby="log-head"]'
	);
	const overpressureChartSection = document.querySelector(
		'section[aria-labelledby="overpressure-chart-head"]'
	);
	function adjustLogPosition() {
		const leftPanel = document.querySelector(".left");
		const rightPanel = document.querySelector(".right");
		const logSection = document.querySelector(
			'section[aria-labelledby="log-head"]'
		);
		const overpressureChartSection = document.querySelector(
			'section[aria-labelledby="overpressure-chart-head"]'
		);
		const contourMapSection = document.querySelector(
			'section[aria-labelledby="contour-map-head"]'
		);

		// ---> TAMBAHKAN CEK INI DI AWAL <---
		if (
			!leftPanel ||
			!rightPanel ||
			!logSection ||
			!overpressureChartSection ||
			!contourMapSection
		) {
			// Jika salah satu elemen layout utama tidak ada (misal di flow-process.html),
			// hentikan fungsi ini agar tidak error.
			// console.log("adjustLogPosition: Missing required layout elements, skipping adjustment."); // Opsional log
			return;
		}
		// ---> AKHIR CEK <---

		const sliderSections = [
			document.getElementById("gangneungSliderContainer"),
			document.getElementById("beirutSliderContainer"),
			document.getElementById("tianjinSliderContainer"),
			document.getElementById("wenlingSliderContainer"),
			document.getElementById("sanjuanicoSliderContainer"),
			document.getElementById("experimentSliderContainer"),
		].filter((el) => el != null);

		if (window.innerWidth <= 1024) {
			// === LOGIKA MOBILE ===
			if (!leftPanel.contains(logSection)) {
				overpressureChartSection.insertAdjacentElement("afterend", logSection);
			}
			let lastMovedElement = contourMapSection;
			sliderSections.forEach((slider) => {
				if (!leftPanel.contains(slider)) {
					lastMovedElement.insertAdjacentElement("afterend", slider);
					lastMovedElement = slider;
				}
			});
		} else {
			// === LOGIKA DESKTOP ===
			if (!rightPanel.contains(logSection)) {
				const firstSliderInRight = rightPanel.querySelector(
					'section[id$="SliderContainer"]'
				);
				if (firstSliderInRight) {
					rightPanel.insertBefore(logSection, firstSliderInRight);
				} else {
					rightPanel.appendChild(logSection);
				}
			}
			sliderSections.forEach((slider) => {
				if (!rightPanel.contains(slider)) {
					rightPanel.appendChild(slider);
				}
			});
		}
	}
	adjustLogPosition();
	const debouncedAdjustLogPosition = debounce(adjustLogPosition, 150);
	window.addEventListener("resize", debouncedAdjustLogPosition);
	window.addEventListener("orientationchange", debouncedAdjustLogPosition);
});
