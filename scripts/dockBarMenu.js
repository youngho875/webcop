window.dockbar = (function() {
    // 스타일을 동적으로 추가
    const style = document.createElement('style');
    style.innerHTML = `
    .dock-bar {
      position: absolute;
      width: 250px;
      background-color: rgba(30, 30, 30, 0.9);
      color: white;
      border: 1px solid #666;
      z-index: 10;
      user-select: none;
    }

    .dock-header {
      padding: 10px;
      background-color: #222;
      cursor: move;
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .toggle-button, .close-button {
      background-color: #444;
      color: white;
      border: none;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 12px;
      margin-left: 5px;
    }

    .dock-content {
      padding: 10px;
    }

    .dock-content.hidden {
      display: none;
    }

    .dock-button {
      display: block;
      margin-bottom: 10px;
      background-color: #444;
      border: none;
      color: white;
      padding: 10px;
      cursor: pointer;
      width: 100%;
    }

    .input-section {
      display: flex;
      margin-top: 10px;
    }

    .input-section input {
      flex: 1;
      padding: 5px;
      margin-right: 5px;
    }

    #addDockBtn {
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 20;
      padding: 8px 12px;
      background-color: #1976d2;
      color: white;
      border: none;
      cursor: pointer;
    }

    #saveBtn {
      position: absolute;
      top: 10px;
      left: 130px;
      z-index: 20;
      padding: 8px 12px;
      background-color: #2e7d32;
      color: white;
      border: none;
      cursor: pointer;
    }
    `;
    document.head.appendChild(style);      


  //<button id="addDockBtn" onclick="createDockBar()">도킹바 추가</button>
  //<button id="saveBtn" onclick="saveAllDockBars()">저장</button>
  //<div id="cesiumContainer"></div>



    let dockCount = 0;
    const dockBars = [];

    function createDockBar(data = null) {
      const dockId = `dockBar${++dockCount}`;
      const dock = document.createElement('div');
      dock.className = 'dock-bar';
      dock.id = dockId;

      dock.style.left = data?.left || `${50 + (dockCount * 30)}px`;
      dock.style.top = data?.top || `${50 + (dockCount * 30)}px`;

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
          dock.style.left = `${e.clientX - offsetX}px`;
          dock.style.top = `${e.clientY - offsetY}px`;
        }
      });
      document.addEventListener('mouseup', () => {
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
    }

    //loadDockBars(); // 페이지 로드시 자동 로드
    return {createDockBar}

})();
  