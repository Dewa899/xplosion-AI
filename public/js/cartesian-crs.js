// public/js/cartesian-crs.js
// VERSI DENGAN LABEL KOORDINAT (X, Y) YANG DIPERBAIKI

/**
 * Mendefinisikan CRS Kartesius kustom (Y-positif ke ATAS).
 */
L.CRS.Cartesian = L.extend({}, L.CRS.Simple, {
	transformation: new L.Transformation(1, 0, -1, 0), // Membalik sumbu Y
	scale: function (zoom) {
		return Math.pow(2, zoom);
	},
	infinite: true,
});

/**
 * Mengembalikan opsi konfigurasi untuk peta Kartesius.
 */
function getCartesianMapOptions() {
	return {
		crs: L.CRS.Cartesian,
		center: [0, 0],
		zoom: 0,
		minZoom: -8, // Ini sudah benar
		maxZoom: 8,
		zoomControl: false,
		fadeAnimation: false,
	};
}

/**
 * Membuat layer grid Kartesius programatis (menggunakan Canvas).
 */
function createCartesianLayers() {
	const CartesianGridLayer = L.GridLayer.extend({
		createTile: function (coords) {
			// 1. Setup Canvas
			const tile = document.createElement("canvas");
			const tileSize = this.getTileSize();
			tile.width = tileSize.x;
			tile.height = tileSize.y;
			const ctx = tile.getContext("2d");

			const zoom = this._map.getZoom();

			// 2. TENTUKAN JARAK GRID & LABEL (LOGIKA BARU YANG LEBIH PADAT)
			let gridStep; // Garis tipis (minor)
			let labelStep; // Garis tebal & berlabel (major)

			if (zoom < -5) { // NEW: Handle very low zoom levels
				gridStep = 2000;
				labelStep = 4000;
			} else if (zoom < -4) {
				gridStep = 500;
				labelStep = 1000;
			} else if (zoom < -1) {
				gridStep = 100;
				labelStep = 500;
			} else if (zoom < 2) {
				gridStep = 50;
				labelStep = 100;
			} else if (zoom < 5) {
				gridStep = 10;
				labelStep = 50;
			} else if (zoom < 7) {
				gridStep = 1;
				labelStep = 10;
			} else {
				gridStep = 0.5;
				labelStep = 1;
			}

			// 3. Dapatkan Batas Koordinat Tile
			const nwPoint = this._map.unproject(coords.scaleBy(tileSize), coords.z);
			const sePoint = this._map.unproject(
				coords.scaleBy(tileSize).add(tileSize),
				coords.z
			);

			// 4. Hitung posisi piksel dari Sumbu Utama (0,0)
			const originPoint = this._map.project([0, 0], coords.z);
			const originXPos = originPoint.x - coords.x * tileSize.x;
			const originYPos = originPoint.y - coords.y * tileSize.y;

			// 5. Gambar Garis Grid (Minor & Major)
			ctx.lineWidth = 0.5;
			ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";

			// Garis Vertikal
			const xStart = Math.ceil(nwPoint.lng / gridStep);
			const xEnd = Math.floor(sePoint.lng / gridStep);
			for (let i = xStart; i <= xEnd; i++) {
				const val = i * gridStep;
				if (val === 0) continue; // Sumbu utama digambar nanti
				const p = this._map.project([nwPoint.lat, val], coords.z);
				const xPos = p.x - coords.x * tileSize.x;
				ctx.beginPath();
				ctx.moveTo(xPos, 0);
				ctx.lineTo(xPos, tileSize.y);
				if (val % labelStep === 0) {
					ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
					ctx.lineWidth = 1;
				}
				ctx.stroke();
				// Reset style
				ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
				ctx.lineWidth = 0.5;
			}

			// Garis Horizontal
			const yStart = Math.ceil(sePoint.lat / gridStep);
			const yEnd = Math.floor(nwPoint.lat / gridStep);
			for (let i = yStart; i <= yEnd; i++) {
				const val = i * gridStep;
				if (val === 0) continue; // Sumbu utama digambar nanti
				const p = this._map.project([val, nwPoint.lng], coords.z);
				const yPos = p.y - coords.y * tileSize.y;
				ctx.beginPath();
				ctx.moveTo(0, yPos);
				ctx.lineTo(tileSize.x, yPos);
				if (val % labelStep === 0) {
					ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
					ctx.lineWidth = 1;
				}
				ctx.stroke();
				// Reset style
				ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
				ctx.lineWidth = 0.5;
			}

			// 6. Gambar Sumbu Utama (X=0 dan Y=0)
			ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
			ctx.lineWidth = 1.5;
			// Cek inklusif (>= 0 dan <= tileSize)
			if (originXPos >= 0 && originXPos <= tileSize.x) {
				ctx.beginPath();
				ctx.moveTo(originXPos, 0);
				ctx.lineTo(originXPos, tileSize.y);
				ctx.stroke();
			}
			if (originYPos >= 0 && originYPos <= tileSize.y) {
				ctx.beginPath();
				ctx.moveTo(0, originYPos);
				ctx.lineTo(tileSize.x, originYPos);
				ctx.stroke();
			}

			// 7. Gambar Label (x, y) di Perpotongan 'labelStep'
			/*
			ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
			ctx.font = "12px Arial";

			const xStartLabel = Math.ceil(nwPoint.lng / labelStep);
			const xEndLabel = Math.floor(sePoint.lng / labelStep);
			const yStartLabel = Math.ceil(sePoint.lat / labelStep);
			const yEndLabel = Math.floor(nwPoint.lat / labelStep);

			for (let i = xStartLabel; i <= xEndLabel; i++) {
				const xVal = i * labelStep;
				for (let j = yStartLabel; j <= yEndLabel; j++) {
					const yVal = j * labelStep;

					const p = this._map.project([yVal, xVal], coords.z); // [Y, X]
					const xPos = p.x - coords.x * tileSize.x;
					const yPos = p.y - coords.y * tileSize.y;

					// Format label
					const label = `(${xVal}, ${yVal})`;

					// Tentukan alignment teks
					if (xVal === 0 && yVal !== 0) {
						// Label di sumbu Y ( (0, 100) )
						ctx.textAlign = "left";
						ctx.fillText(label, xPos + 5, yPos);
					} else if (yVal === 0 && xVal !== 0) {
						// Label di sumbu X ( (100, 0) )
						ctx.textAlign = "center";
						ctx.fillText(label, xPos, yPos - 10);
					} else if (xVal === 0 && yVal === 0) {
						// Label Origin ( (0, 0) )
						ctx.textAlign = "left";
						ctx.fillText(label, xPos + 5, yPos - 10);
					} else {
						// Label di luar sumbu ( (100, 100) )
						// Hanya tampilkan jika tidak terlalu padat (zoom > -1)
						if (zoom > -1) {
							ctx.textAlign = "left";
							ctx.fillText(label, xPos + 5, yPos + 5);
						}
					}
				}
			}
			*/
			return tile;
		},
	});

	return L.layerGroup([new CartesianGridLayer()]);
}
