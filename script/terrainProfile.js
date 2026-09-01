/**
 * TerrainProfileDialog
 *
 * D3 v7 기반의 지형 단면도 다이얼로그입니다.
 *
 * 준비:
 *   <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
 *   <script src="./terrainProfile.js"></script>
 *
 * 기본 사용법:
 *   const profile = new TerrainProfileDialog({ title: "지형 단면도" });
 *   profile.setProfile([
 *     { distance: 0, elevation: 112 },
 *     { distance: 250, elevation: 138 },
 *     { distance: 700, elevation: 91 }
 *   ]).open();
 *
 * 지도/캔버스에서 두 점 선택:
 *   profile.enablePointSelection(mapElement, {
 *     pointResolver: async (event) => ({ lon: 127.1, lat: 37.4, elevation: 120 }),
 *     profileProvider: async (start, end) => terrainSamples
 *   });
 *
 * profileProvider의 반환값은 다음 두 형식 중 하나입니다.
 *   1) [{ distance: 미터, elevation: 미터 }, ...]
 *   2) [{ lon, lat, elevation }, ...]  // distance는 자동 누적 계산
 */
(function (global) {
  "use strict";
  const d3 = global.d3;

  class TerrainProfileDialog {
    constructor(options = {}) {
      if (!global.d3) {
        throw new Error("TerrainProfileDialog에는 D3 v7 이상이 필요합니다.");
      }

      this.options = {
        title: "두 지점 사이 거리 및 고도",
        width: 760,
        height: 430,
        minWidth: 400,
        minHeight: 270,
        distanceUnit: "auto", // auto | m | km
        elevationUnit: "m",
        accentColor: "#0789ae",
        lineColor: "#20b9df",
        fillColor: "rgba(7, 137, 174, 0.18)",
        backgroundColor: "#30343a",
        plotBackgroundColor: "#ffffff",
        axisTextColor: "#263238",
        textColor: "#d8edf3",
        gridColor: "rgba(7, 137, 174, 0.20)",
        showArea: true,
        closeOnEscape: true,
        ...options
      };

      this.data = [];
      this.endpoints = [];
      this.selectionCleanup = null;
      this.resizeObserver = null;
      this.uid = `terrain-profile-${Math.random().toString(36).slice(2)}`;
      this._buildDialog();
    }

    _buildDialog() {
      const o = this.options;
      const menuBottom = this._mainMenuBottom();
      const root = d3.select(document.body)
        .append("div")
        .attr("id", this.uid)
        .attr("role", "dialog")
        .attr("aria-modal", "false")
        .attr("aria-label", o.title)
        .style("display", "none")
        .style("position", "fixed")
        .style("z-index", "10000")
        .style("left", "50%")
        .style("top", `${menuBottom}px`)
        .style("transform", "translateX(-50%)")
        .style("width", `${o.width}px`)
        .style("height", `${o.height}px`)
        .style("min-width", `${o.minWidth}px`)
        .style("min-height", `${o.minHeight}px`)
        .style("max-width", "calc(100vw - 24px)")
        .style("max-height", `calc(100vh - ${menuBottom + 12}px)`)
        .style("resize", "both")
        .style("overflow", "hidden")
        .style("border", `1px solid ${o.accentColor}`)
        .style("border-radius", "8px")
        .style("box-shadow", "0 18px 55px rgba(0,0,0,.65)")
        .style("background", o.backgroundColor)
        .style("color", o.textColor)
        .style("font", "12px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif");

      const header = root.append("div")
        .attr("class", "terrain-profile-titlebar")
        .style("height", "40px")
        .style("box-sizing", "border-box")
        .style("display", "flex")
        .style("align-items", "center")
        .style("justify-content", "space-between")
        .style("padding", "0 8px 0 12px")
        .style("border-bottom", `1px solid ${o.gridColor}`)
        .style("background", "linear-gradient(90deg, rgba(7,137,174,.38), rgba(48,52,58,.98))")
        .style("color", "#ffffff")
        .style("position", "relative")
        .style("z-index", "2")
        .style("cursor", "move")
        .style("user-select", "none");

      header.append("strong").text(o.title).style("letter-spacing", ".02em").style("font-size", "13px");
      header.append("button")
        .attr("type", "button")
        .attr("aria-label", "닫기")
        .text("×")
        .style("border", "0")
        .style("background", "transparent")
        .style("color", o.textColor)
        .style("font-size", "22px")
        .style("cursor", "pointer")
        .on("click", () => this.close());

      this.summary = root.append("div")
        .style("height", "36px")
        .style("box-sizing", "border-box")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "14px")
        .style("padding", "0 12px")
        .style("color", "#9fc6d1");

      this.chartHost = root.append("div")
        .style("width", "100%")
        .style("height", "calc(100% - 76px)")
        .style("background", o.plotBackgroundColor);

      this.svg = this.chartHost.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .style("display", "block");

      this.root = root;
      this._enableDrag(header.node());
      this.resizeObserver = new ResizeObserver(() => this.render());
      this.resizeObserver.observe(root.node());

      this._onKeyDown = (event) => {
        if (event.key === "Escape" && o.closeOnEscape && this.isOpen()) this.close();
      };
      document.addEventListener("keydown", this._onKeyDown);
      this.render();
    }

    _mainMenuBottom() {
      const menu = document.getElementById("menu");
      return menu ? Math.max(8, Math.ceil(menu.getBoundingClientRect().bottom + 8)) : 12;
    }

    _placeBelowMainMenu() {
      const node = this.root?.node();
      if (!node) return;
      const menuBottom = this._mainMenuBottom();
      const rect = node.getBoundingClientRect();
      if (rect.top < menuBottom) {
        const currentTop = Number.parseFloat(getComputedStyle(node).top);
        this.root.style("top", `${(Number.isFinite(currentTop) ? currentTop : rect.top) + menuBottom - rect.top}px`);
      }
      this.root.style("max-height", `calc(100vh - ${menuBottom + 12}px)`);
    }

    _enableDrag(handle) {
      d3.select(handle).call(
        d3.drag().on("start", (event) => {
          const rect = this.root.node().getBoundingClientRect();
          this.root
            .style("left", `${rect.left}px`)
            .style("top", `${rect.top}px`)
            .style("transform", "none");
          event.on("drag", (dragEvent) => {
            const node = this.root.node();
            const box = node.getBoundingClientRect();
            const left = Math.max(0, Math.min(innerWidth - box.width, box.left + dragEvent.dx));
            const minimumTop = this._mainMenuBottom();
            const top = Math.max(minimumTop, Math.min(innerHeight - box.height, box.top + dragEvent.dy));
            this.root.style("left", `${left}px`).style("top", `${top}px`);
          });
        })
      );
    }

    /** 거리(m)와 고도(m)가 포함된 가변 배열로 차트를 갱신합니다. */
    setProfile(samples = []) {
      const normalized = this._normalizeSamples(samples);
      this.data = normalized.sort((a, b) => a.distance - b.distance);
      this.render();
      return this;
    }

    /** 시작점/끝점 정보와 선택 지점의 직선거리를 표시합니다. */
    setEndpoints(start, end) {
      this.endpoints = [start, end];
      return this;
    }

    _normalizeSamples(samples) {
      let cumulative = 0;
      return samples.map((sample, index) => {
        let distance = Number(sample.distance);
        if (!Number.isFinite(distance)) {
          if (index > 0) cumulative += TerrainProfileDialog.haversine(samples[index - 1], sample);
          distance = cumulative;
        } else {
          cumulative = distance;
        }
        return {
          ...sample,
          distance,
          elevation: Number(sample.elevation)
        };
      }).filter(d => Number.isFinite(d.distance) && Number.isFinite(d.elevation));
    }

    render() {
      if (!this.svg) return this;
      const node = this.chartHost.node();
      const width = Math.max(1, node.clientWidth);
      const height = Math.max(1, node.clientHeight);
      const margin = { top: 16, right: 22, bottom: 42, left: 58 };
      const innerWidth = Math.max(1, width - margin.left - margin.right);
      const innerHeight = Math.max(1, height - margin.top - margin.bottom);
      const o = this.options;

      this.svg.selectAll("*").remove();
      this.svg.attr("viewBox", `0 0 ${width} ${height}`);
      const g = this.svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

      // 다이얼로그는 다크 그레이, 실제 그래프 좌표 영역은 흰색으로 구분합니다.
      g.append("rect")
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("fill", o.plotBackgroundColor);

      if (!this.data.length) {
        this.summary.html("<span>지도에서 시작점과 끝점을 클릭하세요.</span>");
        g.append("text")
          .attr("x", innerWidth / 2).attr("y", innerHeight / 2)
          .attr("text-anchor", "middle").attr("fill", o.axisTextColor)
          .text("표시할 거리·고도 데이터가 없습니다.");
        return this;
      }

      const totalDistance = d3.max(this.data, d => d.distance) || 0;
      const distanceDivisor = o.distanceUnit === "km" || (o.distanceUnit === "auto" && totalDistance >= 1000) ? 1000 : 1;
      const distanceLabel = distanceDivisor === 1000 ? "km" : "m";
      const elevations = this.data.map(d => d.elevation);
      let yMin = d3.min(elevations);
      let yMax = d3.max(elevations);
      const yPadding = Math.max((yMax - yMin) * 0.12, 5);
      yMin -= yPadding;
      yMax += yPadding;

      const x = d3.scaleLinear().domain([0, Math.max(totalDistance, 1)]).range([0, innerWidth]);
      const y = d3.scaleLinear().domain([yMin, yMax]).nice().range([innerHeight, 0]);
      const xAxis = d3.axisBottom(x).ticks(Math.max(3, Math.floor(innerWidth / 90)))
        .tickFormat(v => d3.format(distanceDivisor === 1000 ? ".2~f" : ".0f")(v / distanceDivisor));
      const yAxis = d3.axisLeft(y).ticks(Math.max(3, Math.floor(innerHeight / 55)));

      g.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(Math.max(3, Math.floor(innerHeight / 55))).tickSize(-innerWidth).tickFormat(""))
        .call(axis => axis.select(".domain").remove())
        .call(axis => axis.selectAll("line").attr("stroke", o.gridColor));

      if (o.showArea) {
        g.append("path").datum(this.data)
          .attr("fill", o.fillColor)
          .attr("d", d3.area().x(d => x(d.distance)).y0(innerHeight).y1(d => y(d.elevation)).curve(d3.curveMonotoneX));
      }

      g.append("path").datum(this.data)
        .attr("fill", "none").attr("stroke", o.lineColor).attr("stroke-width", 2)
        .attr("d", d3.line().x(d => x(d.distance)).y(d => y(d.elevation)).curve(d3.curveMonotoneX));

      const styleAxis = axis => axis
        .call(a => a.selectAll("path,line").attr("stroke", o.accentColor))
        .call(a => a.selectAll("text").attr("fill", o.axisTextColor));
      g.append("g").attr("transform", `translate(0,${innerHeight})`).call(xAxis).call(styleAxis);
      g.append("g").call(yAxis).call(styleAxis);

      g.append("text").attr("x", innerWidth / 2).attr("y", innerHeight + 42)
        .attr("text-anchor", "middle").attr("fill", o.axisTextColor).text(`거리 (${distanceLabel})`);
      g.append("text").attr("transform", "rotate(-90)").attr("x", -innerHeight / 2).attr("y", -51)
        .attr("text-anchor", "middle").attr("fill", o.axisTextColor).text(`고도 (${o.elevationUnit})`);

      const focus = g.append("g").style("display", "none").style("pointer-events", "none");
      focus.append("line").attr("y1", 0).attr("y2", innerHeight).attr("stroke", "#86dff2").attr("stroke-dasharray", "4 4");
      focus.append("circle").attr("r", 5).attr("fill", o.lineColor).attr("stroke", "white");
      const tooltip = focus.append("g");
      tooltip.append("rect").attr("width", 150).attr("height", 48).attr("rx", 5)
        .attr("fill", "rgba(1,12,16,.92)").attr("stroke", o.accentColor);
      const distanceText = tooltip.append("text").attr("x", 9).attr("y", 19).attr("fill", o.textColor);
      const elevationText = tooltip.append("text").attr("x", 9).attr("y", 38).attr("fill", o.textColor);
      const bisect = d3.bisector(d => d.distance).center;

      g.append("rect").attr("width", innerWidth).attr("height", innerHeight).attr("fill", "transparent")
        .style("cursor", "crosshair")
        .on("mouseenter", () => focus.style("display", null))
        .on("mouseleave", () => focus.style("display", "none"))
        .on("mousemove", event => {
          const mouseX = d3.pointer(event)[0];
          const datum = this.data[bisect(this.data, x.invert(mouseX))];
          const fx = x(datum.distance);
          const fy = y(datum.elevation);
          const tooltipX = fx > innerWidth - 160 ? -158 : 8;
          const tooltipY = Math.max(0, Math.min(innerHeight - 48, fy - 56));
          focus.select("line").attr("x1", fx).attr("x2", fx);
          focus.select("circle").attr("cx", fx).attr("cy", fy);
          tooltip.attr("transform", `translate(${fx + tooltipX},${tooltipY})`);
          distanceText.text(`거리: ${d3.format(distanceDivisor === 1000 ? ".2f" : ".0f")(datum.distance / distanceDivisor)} ${distanceLabel}`);
          elevationText.text(`고도: ${d3.format(".1f")(datum.elevation)} ${o.elevationUnit}`);
        });

      this.summary.html("");
      this.summary.append("span").html(`총 거리 <b style="color:${o.textColor}">${this._formatDistance(totalDistance)}</b>`);
      this.summary.append("span").html(`최저 고도 <b style="color:${o.textColor}">${d3.format(".1f")(d3.min(elevations))} ${o.elevationUnit}</b>`);
      this.summary.append("span").html(`최고 고도 <b style="color:${o.textColor}">${d3.format(".1f")(d3.max(elevations))} ${o.elevationUnit}</b>`);
      return this;
    }

    _formatDistance(meters) {
      if (this.options.distanceUnit === "km" || (this.options.distanceUnit === "auto" && meters >= 1000)) {
        return `${d3.format(".2~f")(meters / 1000)} km`;
      }
      return `${d3.format(".0f")(meters)} m`;
    }

    /**
     * target에서 두 번 클릭해 프로파일을 생성합니다.
     * pointResolver(event): Promise<{ lon, lat, elevation, ... }>
     * profileProvider(start, end): Promise<Array<{distance,elevation}|{lon,lat,elevation}>>
     */
    enablePointSelection(target, { pointResolver, profileProvider, onPoint, onComplete, resetAfterComplete = true } = {}) {
      if (!target || typeof target.addEventListener !== "function") throw new Error("유효한 클릭 대상 요소가 필요합니다.");
      if (typeof pointResolver !== "function") throw new Error("pointResolver 함수가 필요합니다.");
      if (typeof profileProvider !== "function") throw new Error("profileProvider 함수가 필요합니다.");
      this.disablePointSelection();
      let points = [];
      let busy = false;

      const clickHandler = async event => {
        if (busy) return;
        try {
          const point = await pointResolver(event);
          if (!point) return;
          points.push(point);
          if (typeof onPoint === "function") onPoint(point, points.length);
          if (points.length < 2) return;
          busy = true;
          const [start, end] = points;
          this.setEndpoints(start, end);
          const samples = await profileProvider(start, end);
          this.setProfile(samples).open();
          if (typeof onComplete === "function") onComplete({ start, end, samples: this.data });
          if (resetAfterComplete) points = [];
        } catch (error) {
          console.error("TerrainProfileDialog:", error);
          this.showMessage(`프로파일 생성 실패: ${error.message || error}`);
        } finally {
          busy = false;
        }
      };

      target.addEventListener("click", clickHandler);
      this.selectionCleanup = () => target.removeEventListener("click", clickHandler);
      return this;
    }

    disablePointSelection() {
      if (this.selectionCleanup) this.selectionCleanup();
      this.selectionCleanup = null;
      return this;
    }

    showMessage(message) {
      this.data = [];
      this.render();
      this.summary.text(message);
      return this.open();
    }

    open() {
      this.root.style("display", "block");
      this._placeBelowMainMenu();
      this.render();
      document.dispatchEvent(new CustomEvent("dialog-opened", { detail: { element: this.root.node() } }));
      return this;
    }
    close() {
      const wasOpen = this.isOpen();
      this.root.style("display", "none");
      if (wasOpen && typeof this.options.onClose === "function") {
        this.options.onClose(this);
      }
      return this;
    }
    isOpen() { return this.root.style("display") !== "none"; }

    destroy() {
      this.disablePointSelection();
      if (this.resizeObserver) this.resizeObserver.disconnect();
      document.removeEventListener("keydown", this._onKeyDown);
      this.root.remove();
    }

    static haversine(a, b) {
      const lat1 = Number(a.lat ?? a.latitude);
      const lon1 = Number(a.lon ?? a.lng ?? a.longitude);
      const lat2 = Number(b.lat ?? b.latitude);
      const lon2 = Number(b.lon ?? b.lng ?? b.longitude);
      if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return 0;
      const rad = Math.PI / 180;
      const dLat = (lat2 - lat1) * rad;
      const dLon = (lon2 - lon1) * rad;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
      return 6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    }
  }

  global.TerrainProfileDialog = TerrainProfileDialog;
})(typeof window !== "undefined" ? window : globalThis);
