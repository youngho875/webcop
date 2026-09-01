/*
const dockingbar = (function() {
    //const viewer = window.CesiumViewer;

    // 스타일 동적 정의 (CSS 생성)
    function injectDockingBarStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
          #dockPanel {
            width: 300px;
            background-color: #1e1e1e;
            color: white;
            border-left: 1px solid #444;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            padding: 10px;
          }
          
          .dock-bar {
            background-color: #2e2e2e;
            margin-bottom: 10px;
            border: 1px solid #555;
            padding: 0;
          }
          
          .dock-header {
            background-color: #444;
            padding: 8px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .dock-content {
            padding: 8px;
          }
          
          .dock-content.hidden {
            display: none;
          }
          
          .dock-button {
            display: block;
            width: 100%;
            margin-bottom: 5px;
            background-color: #555;
            color: white;
            border: none;
            padding: 8px;
            cursor: pointer;
          }
          
          .input-section {
            display: flex;
            gap: 5px;
          }
          
          .input-section input {
            flex: 1;
            padding: 5px;
          }
          
          .panel-controls button {
            margin-right: 5px;
            padding: 5px 10px;
            border: none;
            background-color: #666;
            color: white;
            cursor: pointer;
          }
        `;
        document.head.appendChild(style);
    }

    let dockCount = 0;
  const dockBars = [];

  function initDockPanel() {
    if (!document.getElementById('dockPanel')) {
      const dockPanel = document.createElement('div');
      dockPanel.id = 'dockPanel';
      dockPanel.innerHTML = `
        <div class="panel-controls">
          <button onclick="dockingbar.create()">도킹바 추가</button>
          <button onclick="dockingbar.saveAll()">저장</button>
          <button onclick="dockingbar.exportJson()">내보내기</button>
          <button onclick="dockingbar.importJson()">불러오기</button>
          <button onclick="dockingbar.toggleGroup('A')">A</button>
          <button onclick="dockingbar.toggleGroup('B')">B</button>
        </div>
        <div id="dockBarList"></div>
      `;
      document.body.appendChild(dockPanel);
    }
  }

  function create(data = null) {
    const dockId = `dockBar${++dockCount}`;
    const group = data?.group || prompt("도킹바 그룹 (예: A, B)", "A") || "A";

    const dock = document.createElement('div');
    dock.className = 'dock-bar';
    dock.id = dockId;
    dock.style.left = data?.left || '${50 + (dockCount * 30)}px';
    dock.style.top = data?.top || '${50 + (dockCount * 30)}px';
    if( data?.group)
        dock.dataset.group = group;

    const header = document.createElement('div');
    header.className = 'dock-header';
    header.innerHTML = `
      <span>도킹바 ${dockCount} (${group})</span>
      <span>
        <button onclick="DockBar.toggle(this)">접기</button>
        <button onclick="DockBar.remove(this)">삭제</button>
      </span>
    `;
    dock.appendChild(header);

    const content = document.createElement('div');
    content.className = 'dock-content';
    if (data?.collapsed) content.classList.add('hidden');

    const buttons = data?.buttons || ['서울', '뉴욕'];
    buttons.forEach(label => {
      const btn = document.createElement('button');
      btn.className = 'dock-button';
      btn.textContent = label;
      btn.onclick = () => alert(`${label} 클릭`);
      content.appendChild(btn);
    });

    const inputSection = document.createElement('div');
    inputSection.className = 'input-section';
    const input = document.createElement('input');
    input.type = 'text';
    const addBtn = document.createElement('button');
    addBtn.textContent = '추가';
    addBtn.onclick = () => {
      if (input.value.trim()) {
        const newBtn = document.createElement('button');
        newBtn.className = 'dock-button';
        newBtn.textContent = input.value;
        newBtn.onclick = () => alert(`${input.value} 클릭`);
        content.insertBefore(newBtn, inputSection);
        input.value = '';
      }
    };
    inputSection.appendChild(input);
    inputSection.appendChild(addBtn);
    content.appendChild(inputSection);

    dock.appendChild(content);
    document.getElementById('dockBarList').appendChild(dock);
    dockBars.push(dock);
  }

  function toggle(button) {
    const content = button.closest('.dock-bar').querySelector('.dock-content');
    content.classList.toggle('hidden');
    button.textContent = content.classList.contains('hidden') ? '펼치기' : '접기';
  }

  function remove(button) {
    const dock = button.closest('.dock-bar');
    dock.remove();
    const idx = dockBars.indexOf(dock);
    if (idx > -1) dockBars.splice(idx, 1);
    saveAll();
  }

  function toggleGroup(group) {
    dockBars.forEach(dock => {
      if (dock.dataset.group === group) {
        const content = dock.querySelector('.dock-content');
        const toggleBtn = dock.querySelector('.dock-header button');
        const isCollapsed = content.classList.contains('hidden');
        if (isCollapsed) {
          content.classList.remove('hidden');
          toggleBtn.textContent = '접기';
        } else {
          content.classList.add('hidden');
          toggleBtn.textContent = '펼치기';
        }
      }
    });
  }

  function saveAll() {
    const data = dockBars.map(dock => {
      const content = dock.querySelector('.dock-content');
      const buttons = [...dock.querySelectorAll('.dock-button')].map(btn => btn.textContent);
      return {
        left: dock.style.left,
        top: dock.style.top,
        group: dock.dataset.group || '',
        buttons,
        collapsed: content.classList.contains('hidden')
      };
    });
    localStorage.setItem('dockBarData', JSON.stringify(data));
  }

  function exportJson() {
    const data = dockBars.map(dock => {
      const content = dock.querySelector('.dock-content');
      const buttons = [...dock.querySelectorAll('.dock-button')].map(btn => btn.textContent);
      return {
        left: dock.style.left,
        top: dock.style.top,
        group: dock.dataset.group || '',
        buttons,
        collapsed: content.classList.contains('hidden')
      };
    });
  
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
  
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dockbars.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function importJson() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
  
    input.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
  
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          if (!Array.isArray(json)) throw new Error("Invalid format");
  
          // 기존 도킹바 제거
          dockBars.forEach(d => d.remove());
          dockBars.length = 0;
  
          json.forEach(data => create(data));
          saveAll();  // 상태 저장
  
        } catch (err) {
          alert("불러오기 실패: JSON 형식이 올바르지 않습니다.");
          console.error(err);
        }
      };
  
      reader.readAsText(file);
    });
  
    input.click(); // 파일 선택 창 열기
  }

  function load() {
    const data = JSON.parse(localStorage.getItem('dockBarData'));
    if (Array.isArray(data)) {
      data.forEach(d => create(d));
    }
    else {
       create({
        "left": "100px",
        "top": "120px",
        "group": "A",
        "buttons": ["서울", "뉴욕"],
        "collapsed": false
      }); 
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    injectDockingBarStyles();
    initDockPanel();
    load();
  });

  return { create, toggle, remove, saveAll, toggleGroup, exportJson, importJson };

})();    
*/    

const dockBar = (function() {
    let dockCount = 0;
    const dockBars = [];

    // The original docking-bar styles were inside the legacy commented block,
    // so the active implementation had no positioning context of its own.
    if (!document.getElementById('dock-bar-active-styles')) {
      const style = document.createElement('style');
      style.id = 'dock-bar-active-styles';
      style.textContent = `
        .dock-bar {
          position: fixed;
          width: 250px;
          max-width: calc(100vw - 16px);
          background: rgba(30, 30, 30, 0.92);
          color: #fff;
          border: 1px solid #666;
          box-sizing: border-box;
          z-index: 900;
          user-select: none;
        }
        .dock-bar .dock-header {
          padding: 8px 10px;
          background: #222;
          cursor: move;
          font-weight: bold;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .dock-bar .dock-content { padding: 10px; }
        .dock-bar .dock-content.hidden { display: none; }
        .dock-bar .dock-button { display: block; width: 100%; margin-bottom: 6px; }
        .dock-bar .input-section { display: flex; gap: 5px; }
        .dock-bar .input-section input { min-width: 0; flex: 1; }
      `;
      document.head.appendChild(style);
    }

    function getTopLimit() {
      const menu = document.getElementById('menu');
      if (!menu) return 8;
      const rect = menu.getBoundingClientRect();
      return Math.max(8, rect.bottom + 8);
    }

    function keepInsideViewport(dock, preferredLeft, preferredTop) {
      const margin = 8;
      const rect = dock.getBoundingClientRect();
      const width = rect.width || dock.offsetWidth || 250;
      const height = rect.height || dock.offsetHeight || 40;
      const minTop = getTopLimit();
      const maxLeft = Math.max(margin, window.innerWidth - width - margin);
      const maxTop = Math.max(minTop, window.innerHeight - height - margin);
      const left = Math.min(Math.max(margin, Number(preferredLeft) || margin), maxLeft);
      const top = Math.min(Math.max(minTop, Number(preferredTop) || minTop), maxTop);

      dock.style.position = 'fixed';
      dock.style.transform = 'none';
      dock.style.right = 'auto';
      dock.style.bottom = 'auto';
      dock.style.left = `${left}px`;
      dock.style.top = `${top}px`;
    }

    function createDockBar(data = null) {
      const dockId = `dockBar${++dockCount}`;
      const dock = document.createElement('div');
      dock.className = 'dock-bar';
      dock.id = dockId;

      const initialLeft = Number.parseFloat(data?.left);
      const initialTop = Number.parseFloat(data?.top);
      dock.style.left = `${Number.isFinite(initialLeft) ? initialLeft : 50 + (dockCount * 30)}px`;
      dock.style.top = `${Number.isFinite(initialTop) ? initialTop : 50 + (dockCount * 30)}px`;

      // Header
      const header = document.createElement('div');
      header.className = 'dock-header';
      header.innerHTML = `
        <span>도킹바 ${dockCount}</span>
        <span>
          <button class="toggle-button">접기</button>
          <button class="close-button">삭제</button>
        </span>
      `;
      dock.appendChild(header);

      // Content
      const content = document.createElement('div');
      content.className = 'dock-content';
      if (data?.collapsed) content.classList.add('hidden');

      // 버튼 로드
      const buttons = data?.buttons || ['서울', '뉴욕'];
      buttons.forEach(label => {
        const btn = document.createElement('button');
        btn.className = 'dock-button';
        btn.textContent = label;
        btn.onclick = () => alert(`${label} 클릭`);
        content.appendChild(btn);
      });

      // 입력 필드
      const inputSection = document.createElement('div');
      inputSection.className = 'input-section';
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = '버튼 이름';
      const addBtn = document.createElement('button');
      addBtn.className = 'toggle-button';
      addBtn.textContent = '추가';
      addBtn.onclick = () => {
        if (input.value.trim()) {
          const newBtn = document.createElement('button');
          newBtn.className = 'dock-button';
          newBtn.textContent = input.value;
          newBtn.onclick = () => alert(`${input.value} 클릭`);
          content.insertBefore(newBtn, inputSection);
          input.value = '';
        }
      };
      inputSection.appendChild(input);
      inputSection.appendChild(addBtn);
      content.appendChild(inputSection);

      dock.appendChild(content);
      document.body.appendChild(dock);
      dockBars.push(dock);

      // Clamp both a newly generated position and an old saved off-screen
      // position after the element has a measurable size.
      requestAnimationFrame(() => {
        keepInsideViewport(dock, Number.parseFloat(dock.style.left), Number.parseFloat(dock.style.top));
      });

      // Toggle
      const toggleBtn = header.querySelector('.toggle-button');
      toggleBtn.addEventListener('click', () => {
        content.classList.toggle('hidden');
        toggleBtn.textContent = content.classList.contains('hidden') ? '펼치기' : '접기';
      });

      // 삭제
      const closeBtn = header.querySelector('.close-button');
      closeBtn.addEventListener('click', () => {
        dock.remove();
        const idx = dockBars.indexOf(dock);
        if (idx > -1) dockBars.splice(idx, 1);
        saveAllDockBars();  // 삭제 후 저장
      });

      // 드래그
      let isDragging = false, offsetX = 0, offsetY = 0;
      header.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - dock.offsetLeft;
        offsetY = e.clientY - dock.offsetTop;
        e.preventDefault();
      });
      document.addEventListener('mousemove', (e) => {
        if (isDragging) {
          keepInsideViewport(dock, e.clientX - offsetX, e.clientY - offsetY);
        }
      });
      document.addEventListener('mouseup', () => {
        if (isDragging) {
          keepInsideViewport(dock, Number.parseFloat(dock.style.left), Number.parseFloat(dock.style.top));
        }
        isDragging = false;
      });
    }

    function saveAllDockBars() {
      const data = dockBars.map(dock => {
        const content = dock.querySelector('.dock-content');
        const buttons = [...dock.querySelectorAll('.dock-button')].map(btn => btn.textContent);
        return {
          left: dock.style.left,
          top: dock.style.top,
          buttons,
          collapsed: content.classList.contains('hidden')
        };
      });
      localStorage.setItem('dockBarData', JSON.stringify(data));
    }

    function loadDockBars() {
      const data = JSON.parse(localStorage.getItem('dockBarData'));
      if (Array.isArray(data)) {
        data.forEach(d => createDockBar(d));
      } else {
        createDockBar(); // 기본 하나 생성
      }
    };

    //loadDockBars(); // 페이지 로드시 자동 로드

    window.addEventListener('resize', () => {
      dockBars.forEach(dock => {
        keepInsideViewport(dock, Number.parseFloat(dock.style.left), Number.parseFloat(dock.style.top));
      });
    });

    return {createDockBar, loadDockBars};

  })();
