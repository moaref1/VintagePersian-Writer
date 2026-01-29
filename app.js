// Vintage Persian Writing Interface - JavaScript
// All functionality for the text editor and project management

const META_KEY = 'vintage_persian_projects_meta';
const LEGACY_KEY = 'vintage_persian_autosave';
let currentProjectId = null;
let projectsMeta = [];
let currentPageIndex = 0;
let isSingleView = true;
let isPaginating = false;
let autoSaveTimeout;
let lastDeletedNode = null;
let lastDeletedParent = null;
let lastDeletedSibling = null;

function initProjects() {
    try {
        const metaRaw = localStorage.getItem(META_KEY);
        projectsMeta = metaRaw ? JSON.parse(metaRaw) : [];
        
        // Migration: Check for legacy save if no projects exist
        if (projectsMeta.length === 0) {
            const legacy = localStorage.getItem(LEGACY_KEY);
            if (legacy) {
                const id = 'proj_' + Date.now();
                const pData = {
                    id: id,
                    name: 'پروژه قدیمی',
                    date: Date.now()
                };
                projectsMeta.push(pData);
                localStorage.setItem('vintage_project_' + id, legacy);
                localStorage.setItem(META_KEY, JSON.stringify(projectsMeta));
                localStorage.removeItem(LEGACY_KEY); 
            } else {
                // Create Default Project
                createNewProject("پروژه پیش‌فرض", true);
                return; 
            }
        }
        
        // Load last active or first project
        const lastActive = localStorage.getItem('vintage_last_active_id');
        const targetProject = projectsMeta.find(p => p.id === lastActive) || projectsMeta[0];
        
        if(targetProject) {
             loadProject(targetProject.id);
        } else {
             createNewProject("پروژه پیش‌فرض", true);
        }
        renderProjectList();
        
    } catch(e) {
        console.error("Project Init Error", e);
        createNewProject("پروژه جديد (Restore)", true);
    }
}

function createNewProject(name, forceLoad = false) {
     const id = 'proj_' + Date.now();
     const pName = name || 'پروژه ' + (projectsMeta.length + 1);
     
     const newProj = {
         id: id,
         name: pName,
         date: Date.now()
     };
     
     projectsMeta.push(newProj);
     localStorage.setItem(META_KEY, JSON.stringify(projectsMeta));
     
     // If we're forcing load (init), just do it
     if (forceLoad) {
         loadProject(id);
     } else {
         renderProjectList();
         // Ask to switch
         if(confirm('پروژه جدید ایجاد شد. آیا مایلید وارد آن شوید؟')) {
             loadProject(id);
         }
     }
}

function loadProject(id) {
    // Auto-Save previous project before switching
    if (currentProjectId && currentProjectId !== id) {
         saveToLocal(true);
    }
    
    currentProjectId = id;
    localStorage.setItem('vintage_last_active_id', id); // Remember active project
    const dataRaw = localStorage.getItem('vintage_project_' + id);
    
    // UI Update
    renderProjectList();
    
    // 1. Reset View (Clear Pages)
    const pages = getAllPages();
    pages.forEach((p, i) => { if(i>0) p.remove(); });
    const p0Content = document.getElementById('page-0').querySelector('.content');
    p0Content.innerHTML = ''; // Clear page 0
    
    // Reset Styles
    changePaper('#f4e4bc'); 
    changeFont("'Amiri', serif");

    if (dataRaw) {
         restoreFromLocal(dataRaw);
    } else {
         // Empty: Create sample content with 10 pages
         createSampleProject();
    }
    
    // Mark sidebar active
    document.querySelectorAll('.project-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === id);
    });
    
    updatePageNumbers();
}

function createSampleProject() {
    // Expanded sample text to fill 10 pages
    const sampleText = "این یک متن تسته، شروع کن و یه چیزی بنویس!"


    const p0Content = document.getElementById('page-0').querySelector('.content');
    if (!p0Content) return;
    
    // Clear existing content
    p0Content.innerHTML = '';
    
    // Insert sample text line by line to allow proper pagination
    const lines = sampleText.split('\n');
    lines.forEach(line => {
        if (line === '') {
            const div = document.createElement('div');
            div.innerHTML = '<br>';
            p0Content.appendChild(div);
        } else {
            const div = document.createElement('div');
            div.textContent = line;
            p0Content.appendChild(div);
        }
    });
    
    // Trigger pagination to split into 10 pages
    setTimeout(() => {
        console.log('Starting pagination for sample project...');
        triggerPagination();
    }, 150);
}

function deleteProject(id, event) {
    if(event) event.stopPropagation();
    if(!confirm('آیا از حذف این پروژه اطمینان دارید؟')) return;
    
    // Remove data
    localStorage.removeItem('vintage_project_' + id);
    
    // Update Meta
    projectsMeta = projectsMeta.filter(p => p.id !== id);
    localStorage.setItem(META_KEY, JSON.stringify(projectsMeta));
    
    if (currentProjectId === id) {
        // We deleted current. Switch!
        if (projectsMeta.length > 0) loadProject(projectsMeta[0].id);
        else createNewProject("پروژه جدید", true);
    } else {
        renderProjectList();
    }
}

function clearAllCache() {
    if (!confirm('همه پروژه‌ها و تنظیمات پاک شوند؟ این کار قابل بازگشت نیست.')) return;

    // Remove all app-related keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith('vintage_project_') || key === META_KEY || key === LEGACY_KEY || key === 'vintage_last_active_id') {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // Reset in-memory state
    projectsMeta = [];
    currentProjectId = null;
    currentPageIndex = 0;

    // Clear pages except page-0
    const pages = getAllPages();
    pages.forEach((p, i) => { if (i > 0) p.remove(); });
    const p0Content = document.getElementById('page-0').querySelector('.content');
    if (p0Content) p0Content.innerHTML = '';

    // Recreate default project
    createNewProject('پروژه پیش‌فرض', true);
    renderProjectList();
}

function renderProjectList() {
     const list = document.getElementById('projectList');
     if(!list) return;
     list.innerHTML = '';
     
     projectsMeta.forEach(p => {
         const item = document.createElement('div');
         item.className = 'project-item';
         if(p.id === currentProjectId) item.classList.add('active');
         item.dataset.id = p.id;
         item.onclick = () => loadProject(p.id);
         // Format Date
         const d = new Date(p.date);
         // Simple formatted date
         const dateStr = d.toLocaleDateString('fa-IR');

         item.innerHTML = `
            <div style="flex:1;">
                <span class="project-title">${p.name}</span>
                <span class="project-meta">${dateStr}</span>
            </div>
            <button class="project-del" onclick="deleteProject('${p.id}', event)">×</button>
         `;
         list.appendChild(item);
     });
}

function toggleSidebar() {
    document.getElementById('projectSidebar').classList.toggle('open');
}

function saveToLocal(silent = false) {
    if (!currentProjectId) return;

    const pages = getAllPages().map(p => p.querySelector('.content').innerHTML);
    const data = {
        pages: pages,
        bgColor: document.documentElement.style.getPropertyValue('--paper-color'),
        font: document.documentElement.style.getPropertyValue('--font-current'),
        currentPageIndex: currentPageIndex,
        isSingleView: isSingleView,
        date: new Date().getTime()
    };
    
    try {
        localStorage.setItem('vintage_project_' + currentProjectId, JSON.stringify(data));
        
        // Update timestamp
        const pIndex = projectsMeta.findIndex(p => p.id === currentProjectId);
        if(pIndex !== -1) {
            projectsMeta[pIndex].date = data.date;
            localStorage.setItem(META_KEY, JSON.stringify(projectsMeta));
        }
        
        if (!silent) {
            const toast = document.getElementById('saveToast');
            toast.style.opacity = '1';
            setTimeout(() => toast.style.opacity = '0', 2000);
        }
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            alert('خطا: حافظه مرورگر پر شده است. لطفاً پروژه با تصاویر کمتری بسازید یا پروژه‌های قدیمی را پاک کنید.');
        } else {
            console.error('Save failed', e);
        }
    }
}

function fixPhotoStructures() {
    document.querySelectorAll('.photo-wrapper').forEach(wrapper => {
        const frame = wrapper.querySelector('.photo-frame');
        if (!frame) return;

        // 1. Ensure Caption Exists
        let caption = frame.querySelector('.photo-caption');
        if (!caption) {
            caption = document.createElement('div');
            caption.className = 'photo-caption';
            caption.contentEditable = true;
            caption.spellcheck = false;
            frame.appendChild(caption);
        }
        
        // 2. Refresh Caption Listeners
        if (!caption._listenersAttached) {
            caption.addEventListener('blur', () => {
                caption.classList.remove('editing');
                triggerPagination(); 
            });
            caption.addEventListener('mousedown', (e) => {
                if(caption.classList.contains('editing')) e.stopPropagation();
            });
            caption._listenersAttached = true;
        }

        // 3. Refresh Frame Listeners (DblClick)
        if (!frame._dblAttached) {
            frame.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                caption.classList.add('editing');
                caption.focus();
            });
            frame._dblAttached = true;
        }
        
        // 4. Refresh Drag on Wrapper
        if (!wrapper._dragAttached) {
           wrapper.draggable = true;
           wrapper.addEventListener('dragstart', (e) => {
               e.dataTransfer.effectAllowed = 'move';
               e.dataTransfer.setData('text/plain', '');
               window.draggedPhoto = wrapper;
               setTimeout(() => wrapper.style.opacity = '0.5', 0);
           });
           wrapper.addEventListener('dragend', (e) => {
               wrapper.style.opacity = '1';
               window.draggedPhoto = null;
           });
           wrapper._dragAttached = true;
        }
    });
}

function restoreFromLocal(rawJSON) {
    // rawJSON is passed from loadProject. 
    // If called without args (legacy?), fail gracefully or use default?
    // Actually, we should only call this with data now.
    if (!rawJSON) return;
    
    console.log('Restoring data...');
    try {
        const data = (typeof rawJSON === 'string') ? JSON.parse(rawJSON) : rawJSON;
        
        // Pages are already cleared by loadProject
        // page-0 exists and is empty
        
        data.pages.forEach((html, index) => {
            let page;
            if (index === 0) page = document.getElementById('page-0');
            else page = createPage(false); // [FIX]: Don't auto switch during restore
            
            page.querySelector('.content').innerHTML = html;
            // Critical: Re-attach listeners to restored content (fixes event loss)
            attachListeners(page.querySelector('.content'));
        });
        
        if(data.bgColor) changePaper(data.bgColor);
        if(data.font) {
            changeFont(data.font);
            document.getElementById('fontSelect').value = data.font;
        }
        
        // Single-view only: ignore stored view mode
        isSingleView = true;
        const container = document.getElementById('bookContainer');
        if (container) container.classList.add('single-view');
        
        // Restore page position (where user was reading)
        if(data.currentPageIndex !== undefined) {
            currentPageIndex = Math.min(data.currentPageIndex, getAllPages().length - 1);
        }

        // Migration / Live Fix
        fixPhotoStructures();
        
        // Update Pagination Display
        updatePageNumbers();

    } catch(e) { console.error('Error restoring', e); }
}

// --- Save PDF (Trigger Print) ---
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        saveFile();
    }
    detectMode();
});
document.addEventListener('mouseup', detectMode);
document.addEventListener('keyup', detectMode);

function saveFile() {
     // Browser Print is the best way to get visual PDF
     window.print();
}

// --- View Toggle ---
function toggleView() {
    // Single-view only: no-op
    isSingleView = true;
    const container = document.getElementById('bookContainer');
    if (container) container.classList.add('single-view');
    saveToLocal(true);
    updatePaginationDisplay();
}

// --- Navigation ---
function getAllPages() { return Array.from(document.querySelectorAll('.page')); }

function updatePaginationDisplay() {
    const pages = getAllPages();
    if (currentPageIndex < 0) currentPageIndex = 0;
    if (currentPageIndex >= pages.length) currentPageIndex = pages.length - 1;

    pages.forEach(p => p.classList.remove('hidden-page'));

    const placeholder = document.getElementById('pagePlaceholder');
    if (placeholder) placeholder.style.display = 'none';
    
    document.getElementById('pageInfo').innerText = 
        `${toPersianDigits(currentPageIndex + 1)} / ${toPersianDigits(pages.length)}`;
}

function scrollToPage(index) {
    const pages = getAllPages();
    const target = pages[index];
    if (!target) return;
    currentPageIndex = index;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    updatePaginationDisplay();
}

function updateCurrentPageFromScroll() {
    const container = document.getElementById('bookContainer');
    if (!container) return;
    const pages = getAllPages();
    if (pages.length === 0) return;

    const containerRect = container.getBoundingClientRect();
    let closestIndex = 0;
    let closestDist = Infinity;

    pages.forEach((p, idx) => {
        const rect = p.getBoundingClientRect();
        const dist = Math.abs(rect.top - containerRect.top);
        if (dist < closestDist) {
            closestDist = dist;
            closestIndex = idx;
        }
    });

    if (closestIndex !== currentPageIndex) {
        currentPageIndex = closestIndex;
        updatePaginationDisplay();
    }
}

function nextPage() {
    const pages = getAllPages();
    if (currentPageIndex + 1 < pages.length) {
        scrollToPage(currentPageIndex + 1);
    }
}

function prevPage() {
    if (currentPageIndex > 0) {
        scrollToPage(currentPageIndex - 1);
    }
}

function addNewPageManual() {
    const newPage = createPage(false);
    const pages = getAllPages();
    const newIndex = pages.indexOf(newPage);
    updatePageNumbers();
    updatePaginationDisplay();
    if (newIndex !== -1) scrollToPage(newIndex);
    const content = newPage.querySelector('.content');
    if (content) content.focus();
}

// --- Content Logic ---
// Note: compressContent logic was removed to avoid automatic space/line deletion
function compressContent(container) {
    // Disabled to prevent automatic deletion of user content
}

function checkOverflow(content) {
    // +2 پیکسل برای اطمینان و جلوگیری از خطای محاسباتی مرورگر
    return content.scrollHeight > content.clientHeight + 2;
}

function moveContent(curr, next) {
    if (!curr || !next) return false;
    let moved = false;
    
    // استفاده از DocumentFragment برای جابجایی گروهی (بسیار سریع‌تر)
    const nodesToMove = [];
    let safety = 0;
    
    // محدودیت را بالا می‌بریم اما نه بی‌نهایت
    const maxSafety = 500; 

    // تا زمانی که صفحه سرریز دارد، آیتم‌ها را از آخر جمع می‌کنیم
    while (checkOverflow(curr) && curr.lastChild && safety < maxSafety) {
        const el = curr.lastChild;
        nodesToMove.push(el); // ذخیره در آرایه موقت
        curr.removeChild(el); // حذف از صفحه جاری
        
        safety++;
        // هر ۵۰ آیتم یکبار، ظاهر صفحه را رفرش می‌کنیم تا محاسبات دقیق بماند
        if (safety % 50 === 0) void curr.offsetHeight; 
    }

    if (nodesToMove.length > 0) {
        moved = true;
        // چون از آخر برداشتیم، ترتیب آرایه درست است برای insertBefore
        for (let i = 0; i < nodesToMove.length; i++) {
             next.insertBefore(nodesToMove[i], next.firstChild);
        }
    }

    return moved;
}

// Global observer for deletion
let observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
            mutation.removedNodes.forEach(function(node) {
                if (node.nodeType === 1 && node.classList.contains('photo-wrapper')) {
                    // Show toast
                    showUndoToast();
                }
            });
        }
    });
});

function showUndoToast() {
    const t = document.getElementById('undoToast');
    t.classList.add('visible');
    setTimeout(() => { if(!t.matches(':hover')) hideUndoToast(); }, 5000);
}

function hideUndoToast() {
    document.getElementById('undoToast').classList.remove('visible');
}

// [FIXED] Added autoSwitch parameter to prevent random jumping during pagination loops
function createPage(autoSwitch = true) {
    const id = getAllPages().length;
    const page = document.createElement('article');
    page.className = 'page hidden-page'; 
    page.id = 'page-' + id;
    
    const border = document.createElement('div');
    border.className = 'page-border';
    
    const content = document.createElement('div');
    content.className = 'content';
    content.contentEditable = 'true';
    content.spellcheck = 'false';
    
    const pageNum = document.createElement('div');
    pageNum.className = 'page-number';
    pageNum.innerText = toPersianDigits(id + 1);
    
    page.appendChild(border);
    page.appendChild(content);
    page.appendChild(pageNum);
    
    const placeholder = document.getElementById('pagePlaceholder');
    const container = document.getElementById('bookContainer');
    if(placeholder) container.insertBefore(page, placeholder);
    else container.appendChild(page);

    attachListeners(content);
    observer.observe(content, { childList: true, subtree: true }); // Observe new pages!
    
    // Only auto-navigate if requested (e.g. creating new page manually, not via pagination)
    if (autoSwitch) {
        setTimeout(() => {
            currentPageIndex = id;
            updatePaginationDisplay();
        }, 100);
    }
    
    return page;
}

function toPersianDigits(n) {
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return n.toString().replace(/\d/g, x => farsiDigits[x]);
}

function updatePageNumbers() {
     const pages = getAllPages();
     const total = toPersianDigits(pages.length);
     pages.forEach((p, i) => {
         const numDiv = p.querySelector('.page-number');
         if(numDiv) {
             numDiv.innerText = `${toPersianDigits(i + 1)}`;
         }
     });
     // Also update the bottom bar info
     document.getElementById('pageInfo').innerText = 
        `${toPersianDigits(currentPageIndex + 1)} / ${total}`;
}

// Loop removed duplicate compressContent


async function triggerPagination() {
    if (isPaginating) return;
    
    // [PRESERVE SELECTION] Place a temporary marker to keep cursor position
    const sel = window.getSelection();
    let marker = null;
    let activeEl = document.activeElement;
    if (activeEl && activeEl.classList.contains('content') && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        marker = document.createElement('span');
        marker.id = 'selection-marker';
        marker.style.display = 'none';
        range.insertNode(marker);
    }

    isPaginating = true;

    // کمی صبر برای رندر شدن متن پیست شده
    await new Promise(r => setTimeout(r, 50));

    // این متغیر تضمین می‌کند اگر ۴۰۰ خط دارید، تا ۲۰ بار کل صفحات را چک کند تا همه چیز مرتب شود
    const maxPasses = 20; 
    let pass = 0;
    let stability = false;

    try {
        while (!stability && pass < maxPasses) {
            stability = true; // فرض می‌کنیم همه چیز مرتب است مگر خلافش ثابت شود
            const pages = getAllPages();

            for (let i = 0; i < pages.length; i++) {
                const currPage = pages[i];
                const currContent = currPage.querySelector('.content');
                
                // اگر صفحه محتوا ندارد رد شو
                if (!currContent) continue;

                // --- عملیات هل دادن به جلو (Push Forward) ---
                // تا زمانی که صفحه سرریز دارد (ارتفاع محتوا بیشتر از ارتفاع باکس است)
                // و هنوز محتوایی برای جابجایی وجود دارد
                while (currContent.scrollHeight > currContent.clientHeight + 2 && currContent.lastChild) {
                    
                    // [SMART SINGLE-BLOCK TRAP FIX]
                    // If there is only 1 child and it's overflowing, don't just break - split intelligently
                    if (currContent.children.length === 1) {
                         const child = currContent.firstElementChild;
                         let splitted = false;
                         
                         if (child && !child.querySelector('.photo-wrapper')) {
                             // Try splitting by <br> tags first (respects user breaks)
                             if (child.innerHTML && (child.innerHTML.includes('<br>') || child.innerHTML.includes('</div>'))) {
                                 const parts = child.innerHTML.split(/<br\s*\/?>/i);
                                 if (parts.length > 1) {
                                     // Split by breaks - keep first half, move second half
                                     const midPoint = Math.floor(parts.length / 2);
                                     const firstHalf = parts.slice(0, midPoint).join('<br/>');
                                     const secondHalf = parts.slice(midPoint).join('<br/>');
                                     
                                     if (secondHalf.length > 0) {
                                         child.innerHTML = firstHalf;
                                         const newDiv = document.createElement('div');
                                         newDiv.innerHTML = secondHalf;
                                         currContent.appendChild(newDiv);
                                         stability = false;
                                         splitted = true;
                                         continue;
                                     }
                                 }
                             }
                             // If no <br> tags, try word-count split for very long text
                             else if (child.textContent && child.textContent.length > 100) {
                                 const text = child.textContent;
                                 const mid = Math.floor(text.length / 2);
                                 const spaceIdx = text.indexOf(' ', mid);
                                 
                                 if (spaceIdx !== -1) {
                                     const firstHalf = text.substring(0, spaceIdx);
                                     const secondHalf = text.substring(spaceIdx); 
                                     
                                     child.textContent = firstHalf;
                                     const newDiv = document.createElement('div');
                                     newDiv.textContent = secondHalf;
                                     currContent.appendChild(newDiv);
                                     stability = false;
                                     splitted = true;
                                     continue;
                                 }
                            }
                         }
                         
                         // If couldn't split, break to prevent infinite loop
                         if (!splitted) {
                             break;
                         }
                    }

                    stability = false; // تغییری ایجاد کردیم، پس باید دوباره چک کنیم
                    
                    // صفحه بعدی را پیدا کن، اگر نبود بساز
                    let nextPage = pages[i + 1];
                    if (!nextPage) {
                        nextPage = createPage(false); // [FIXED] Pass false to avoid auto-switch
                        pages.push(nextPage); // به لیست محلی اضافه کن
                    }
                    
                    const nextContent = nextPage.querySelector('.content');
                    
                    // آخرین خط صفحه فعلی را بردار و بگذار اولِ صفحه بعدی
                    // این کار را یکی‌یکی انجام می‌دهیم تا دقیق‌ترین نتیجه را بگیریم
                    const nodeToMove = currContent.lastChild;
                    
                    // انتقال به صفحه بعد
                    if (nextContent.firstChild) {
                        nextContent.insertBefore(nodeToMove, nextContent.firstChild);
                    } else {
                        nextContent.appendChild(nodeToMove);
                    }
                }
            }
            pass++;
        }

        // پاکسازی خودکار صفحات خالی غیرفعال شد (برای حفظ خطوط/فاصله‌ها)

    } catch (err) {
        console.error("Pagination Error:", err);
    } finally {
        isPaginating = false;
        
        // [RESTORE SELECTION]
        if (marker) {
            const parent = marker.parentNode;
            if (parent) {
                const range = document.createRange();
                range.setStartAfter(marker);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                
                // If it moved to a hidden page, we might need to update current view
                let pageOfMarker = parent.closest('.page');
                if (pageOfMarker) {
                    const pages = getAllPages();
                    const newIdx = pages.indexOf(pageOfMarker);
                    if (newIdx !== -1 && !isSingleView) {
                         // Logic to align spread to show the cursor
                         if (newIdx !== currentPageIndex && newIdx !== currentPageIndex + 1) {
                             // Adjust currentPageIndex to show this spread
                             currentPageIndex = newIdx % 2 === 0 ? newIdx : newIdx - 1;
                         }
                    } else if (newIdx !== -1 && isSingleView) {
                         if (newIdx !== currentPageIndex) currentPageIndex = newIdx;
                    }
                }
            }
            marker.remove();
        }

        updatePageNumbers();
        updatePaginationDisplay();
    }
}


// --- Drag & Drop Global Handler ---
let dragIndicator = null;

function removeDragIndicator() {
    if (dragIndicator && dragIndicator.parentNode) {
        dragIndicator.parentNode.removeChild(dragIndicator);
    }
    dragIndicator = null;
}

document.addEventListener('dragover', (e) => {
    if (window.draggedPhoto) {
        e.preventDefault(); 
        e.dataTransfer.dropEffect = 'move';
        
        // Show indicator
         const closestContent = e.target.closest('.content');
         if (closestContent) {
            const range = document.caretRangeFromPoint(e.clientX, e.clientY);
            if (range) {
                if (!dragIndicator) {
                    dragIndicator = document.createElement('div');
                    dragIndicator.className = 'drag-indicator';
                }
                range.insertNode(dragIndicator);
                range.collapse(false);
            }
         }
    }
});

document.addEventListener('dragleave', (e) => {
    // Flicker prevention could be complex, simple remove might be enough
    // if (e.relatedTarget && !e.relatedTarget.closest('.content')) removeDragIndicator();
});

document.addEventListener('drop', (e) => {
    // Priority: File Drop (External)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
         e.preventDefault();
         const files = e.dataTransfer.files;
         for (let i = 0; i < files.length; i++) {
             if (files[i].type.startsWith('image/')) {
                 const reader = new FileReader();
                 // We need to capture the drop location
                 // caretRangeFromPoint is webkit, caretPositionFromPoint standard
                 // We will try to set selection to drop point BEFORE reading
                 // so insertPhoto uses correct location.
                 
                 if(document.caretRangeFromPoint) {
                     const range = document.caretRangeFromPoint(e.clientX, e.clientY);
                     if (range) {
                         const sel = window.getSelection();
                         sel.removeAllRanges();
                         sel.addRange(range);
                     }
                 }
                 
                 reader.onload = function(evt) {
                     insertPhoto(evt.target.result);
                 };
                 reader.readAsDataURL(files[i]);
             }
         }
         removeDragIndicator();
         return;
    }
    
    // Internal Move Drop
    if (window.draggedPhoto) {
        e.preventDefault();
        removeDragIndicator();
        
        const target = e.target;
        const closestContent = target.closest('.content');
        if (closestContent) {
            const range = document.caretRangeFromPoint(e.clientX, e.clientY);
            if (range) {
                range.insertNode(window.draggedPhoto);
                window.draggedPhoto.scrollIntoView({behavior:'smooth', block:'center'});
            } else {
                closestContent.appendChild(window.draggedPhoto);
            }
            triggerPagination();
        }
        
        window.draggedPhoto.style.opacity = '1';
        window.draggedPhoto = null;
    }
});

// Persian Input Handling (Spacing + Digits)
const persianSuffixes = ['ها', 'های', 'هایی', 'تر', 'ترین', 'اند', 'ایم', 'اید', 'ام'];
function handlePersianInput(event) {
    if (event.inputType === 'insertText' || event.inputType === 'insertFromPaste') {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        const node = range.endContainer;
        
        if (node.nodeType === Node.TEXT_NODE) {
            let text = node.nodeValue;
            const endPos = range.endOffset;
            
            // 1. Digit Conversion (Immediate)
            // Only convert the character just typed or checking the whole node?
            // To avoid fighting the user, let's just convert [0-9] found in the text.
            // But we want to preserve cursor.
            if (/[0-9]/.test(text)) {
                const newText = text.replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
                if (newText !== text) {
                    node.nodeValue = newText;
                    text = newText; // update for next step
                    // Restore cursor (digits are 1:1 length)
                    const newRange = document.createRange();
                    newRange.setStart(node, endPos);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
            }

            // 2. Half-Space Logic (Enabled)
            const textBefore = text.substring(0, endPos);
            let newTextBefore = textBefore;
            let changed = false;
            
            persianSuffixes.forEach(suffix => {
                const pattern = new RegExp(`(\\S) (${suffix})$`); 
                if (pattern.test(newTextBefore)) {
                     newTextBefore = newTextBefore.replace(pattern, '$1\u200C$2');
                     changed = true;
                }
            });

            if (/(^|[\s\u200C])(می|نمی) $/.test(newTextBefore)) {
                newTextBefore = newTextBefore.replace(/(می|نمی) $/, '$1\u200C');
                changed = true;
            }

            if (changed) {
                const textAfter = text.substring(endPos);
                node.nodeValue = newTextBefore + textAfter;
                const newPos = newTextBefore.length;
                const newRange = document.createRange();
                newRange.setStart(node, newPos);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        }
    }
}

function attachListeners(el) {
    if (el.dataset.listenersAttached === 'true') return;
    el.dataset.listenersAttached = 'true';
    
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
             const sel = window.getSelection();
             if (sel.rangeCount > 0) {
                 const node = sel.anchorNode;
                 if (node.nodeType === 1) {
                     // Check direct selection
                     if (node.classList.contains('photo-wrapper')) {
                         e.preventDefault();
                         deletePhotoWrapper(node);
                         return;
                     }

                     // Check contextual neighbors (Chrome/Firefox handle element selection differently)
                     const child = node.childNodes[sel.anchorOffset];
                     if (child && child.nodeType === 1 && child.classList.contains('photo-wrapper')) {
                         e.preventDefault();
                         deletePhotoWrapper(child);
                         return;
                     }
                     
                     if (e.key === 'Backspace' && sel.anchorOffset > 0) {
                         const prev = node.childNodes[sel.anchorOffset - 1];
                         if (prev && prev.nodeType === 1 && prev.classList.contains('photo-wrapper')) {
                             e.preventDefault();
                             deletePhotoWrapper(prev);
                             return;
                         }
                     }

                     if (e.key === 'Delete' && sel.anchorOffset < node.childNodes.length) {
                         const next = node.childNodes[sel.anchorOffset];
                         if (next && next.nodeType === 1 && next.classList.contains('photo-wrapper')) {
                             e.preventDefault();
                             deletePhotoWrapper(next);
                             return;
                         }
                     }
                 }
             }
        }
    });

    el.addEventListener('input', (e) => {
        handlePersianInput(e);
        // Debounce pagination to avoid rapid repeated calls that cause instability
        // Increased to 500ms to allow smoother typing before heavy DOM manipulation
        clearTimeout(el._paginationTimeout);
        el._paginationTimeout = setTimeout(() => triggerPagination(), 500);

        // Add Auto-Save Debounce
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => saveToLocal(true), 1000);
    });
    el.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) {
             if (item.type.indexOf('image') !== -1) {
                 e.preventDefault();
                 const blob = item.getAsFile();
                 const reader = new FileReader();
                 reader.onload = function(evt){ insertPhoto(evt.target.result); };
                 reader.readAsDataURL(blob);
                 return; // Handled image
             }
        }
        
        // Text paste: prevent default to allow clean insert & granular DOM
        e.preventDefault();
        const text = (e.clipboardData).getData('text/plain');
        
        if (text) {
            // 1. Normalize line endings
            const lines = text.split(/\r?\n/);
            let htmlToInsert = '';
            
            // 2. Wrap strings in Divs to ensure granular pagination
            lines.forEach(line => {
                // Modified: Removed .trim() check to preserve lines containing only spaces
                if (line === '') {
                    htmlToInsert += '<div><br></div>';
                } else {
                    const safeLine = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    htmlToInsert += `<div>${safeLine}</div>`;
                }
            });

            // 3. Insert as HTML to keep structure
            document.execCommand('insertHTML', false, htmlToInsert);
            
            // 4. Force immediate heavy pagination
            setTimeout(() => {
                // Force full re-check
                triggerPagination();
            }, 10);
        }
    });
}

// --- Color & Settings ---
function changePaper(color) {
    document.documentElement.style.setProperty('--paper-color', color);
    saveToLocal(true);
}

function setPaperPreset(color, btn) {
     changePaper(color);
     document.querySelectorAll('.color-preset').forEach(b => b.classList.remove('active'));
     if(btn) btn.classList.add('active');
}

const CUSTOM_COLORS_KEY = 'vintage_persian_custom_colors';
function addCustomColor(color) {
    changePaper(color);
    
    // Save to storage
    let colors = [];
    try { colors = JSON.parse(localStorage.getItem(CUSTOM_COLORS_KEY)) || []; } catch(e){}
    
    // Avoid duplicates in storage
    if(!colors.includes(color)) {
        colors.push(color);
        // Limit to last 5
        if(colors.length > 5) colors.shift(); 
        localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(colors));
    }
    
    renderCustomColors();
}

function renderCustomColors() {
     const container = document.getElementById('paletteContainer');
     if(!container) return;
     
     // Remove existing custom buttons (all children except the last one which is the picker)
     while(container.children.length > 1) {
         container.removeChild(container.firstChild);
     }
     
     // Load from storage
     let colors = [];
     try { colors = JSON.parse(localStorage.getItem(CUSTOM_COLORS_KEY)) || []; } catch(e){}
     
     colors.forEach(color => {
         const btn = document.createElement('button');
         btn.className = 'color-preset custom-btn'; // custom-btn just for specific styling if needed
         btn.style.backgroundColor = color;
         btn.title = "سفارشی";
         btn.onclick = function() { setPaperPreset(color, this); };
         
         // If active?
         if (getComputedStyle(document.documentElement).getPropertyValue('--paper-color').trim() === color) {
             btn.classList.add('active');
         }
         
         container.insertBefore(btn, container.lastElementChild);
     });
}

function restoreCustomColors() {
     renderCustomColors();
}

function toggleLowQuality() {
    document.body.classList.toggle('low-quality');
}
function changeFont(font) {
    document.documentElement.style.setProperty('--font-current', font);
    saveToLocal(); // Visible save
}
function formatStyle(cmd) { 
    document.execCommand(cmd, false, null); 
    // Keep focus for subsequent shortcuts
    const sel = window.getSelection();
    if(sel.rangeCount > 0) {
         const node = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
         if(node.closest('.content')) node.closest('.content').focus();
    }
}

function applyClass(cls) {
    const sel = window.getSelection();
    if(!sel.rangeCount) return;
    let range = sel.getRangeAt(0);
    
    // If already inside this class, remove (toggle off)
    let container = range.commonAncestorContainer;
    if(container.nodeType === 3) container = container.parentNode;
    
    // TOGGLE OFF: Check if single block modification
    if (container.classList.contains(cls)) {
        const text = document.createTextNode(container.innerText);
        container.parentNode.replaceChild(text, container);
        return;
    }
    
    // SWITCH STYLE: If inside another special block
    if (container.classList.contains('dialogue-style') || container.classList.contains('poetry-style')) {
        container.classList.remove('dialogue-style', 'poetry-style');
        container.classList.add(cls);
        return;
    }

    // APPLY NEW: Handle Multi-line Text
    const text = range.toString();
    if(text.length) {
        range.deleteContents();
        
        const fragment = document.createDocumentFragment();
        // Split by logical lines
        const lines = text.split(/\r?\n/);
        
        lines.forEach(line => {
            // Clean up
            // If line is empty, we might want a BR or empty DIV.
            if (line.trim().length === 0) {
                 const div = document.createElement('div');
                 div.innerHTML = '<br>';
                 fragment.appendChild(div);
            } else {
                const div = document.createElement('div');
                div.className = cls;
                div.innerText = line;
                fragment.appendChild(div);
            }
        });
        
        range.insertNode(fragment);
        
        // Since we inserted a fragment, the range is now collapsed at start or end.
        // We don't easily re-select the whole thing without calculating positions.
        // But this fulfills "count endl as i typed them so each dilog would be seprated".
        
        triggerPagination();
    }
}
function detectMode() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    let node = sel.anchorNode;
    if (node.nodeType === 3) node = node.parentNode;
    const indicator = document.getElementById('modeIndicator');
    if (node.classList.contains('dialogue-style')) {
        indicator.innerText = "حالت: گفتگو"; indicator.classList.add('active');
    } else if (node.classList.contains('poetry-style')) {
        indicator.innerText = "حالت: شعر"; indicator.classList.add('active');
    } else { indicator.classList.remove('active'); }
}

// --- Raw Mode ---
let tempImageStore = [];

function openRawMode() {
    const pages = getAllPages();
    tempImageStore = []; // Reset
    let fullText = "";
    let imgCount = 1;

    pages.forEach(p => {
        const content = p.querySelector('.content');
        // Iterate child nodes to capture text AND images in order
        content.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                fullText += node.nodeValue;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.classList.contains('photo-wrapper')) {
                    // Store the actual complete wrapper
                    tempImageStore.push(node.cloneNode(true));
                    fullText += `\n[[IMAGE_${imgCount}]]\n`;
                    imgCount++;
                } else if (node.tagName === 'DIV' || node.tagName === 'BR') {
                   // Handle line breaks
                   if (node.tagName === 'BR') fullText += '\n';
                   else {
                       // recursive? Or just simple innerText for divs
                       // Simple blocks usually
                       let txt = node.innerText;
                       // Check for nested images? Complex. 
                       // For now assume flat structure maintained by our scripts
                       if (node.querySelector('.photo-wrapper')) {
                           // Extract image from div if nested
                           const img = node.querySelector('.photo-wrapper');
                           tempImageStore.push(img.cloneNode(true));
                           txt = txt.replace(img.innerText, ''); // wrapper has no text usually
                           fullText += `\n[[IMAGE_${imgCount}]]\n` + txt + '\n';
                           imgCount++;
                       } else {
                           fullText += txt + '\n';
                       }
                   }
                } else {
                    fullText += node.innerText;
                }
            }
        });
        fullText += "\n"; // Page break separator logic if needed, or just flow
    });
    
    // Clean up excessive newlines
    fullText = fullText.replace(/\n{3,}/g, '\n\n');
    
    document.getElementById('rawTextarea').value = fullText;
    document.getElementById('rawModal').classList.add('active');
}

function closeRawMode() {
    document.getElementById('rawModal').classList.remove('active');
    tempImageStore = []; // Clear memory
}

function saveRawText() {
    const raw = document.getElementById('rawTextarea').value;
    
    // 1. Clear all pages except 0
    const pages = getAllPages();
    pages.forEach((p, i) => { if(i > 0) p.remove(); });
    
    // 2. Process content
    let html = "";
    const lines = raw.split('\n');
    
    lines.forEach(line => {
        const imgMatch = line.match(/\[\[IMAGE_(\d+)\]\]/);
        if (imgMatch) {
            const index = parseInt(imgMatch[1]) - 1;
            if (tempImageStore[index]) {
                 // Insert placeholder for now, we will replace after innerHTML set
                 // We can't put element into string easily without serialization
                 // Serialize the stored element?
                 html += `<div id="restore-img-${index}"></div>`;
            }
        } else {
            if (line.trim() !== "") html += `<div>${line}</div>`;
            else html += `<div><br></div>`;
        }
    });
    
    const p0box = document.getElementById('page-0').querySelector('.content');
    p0box.innerHTML = html;
    
    // 3. Restore Images
    tempImageStore.forEach((node, i) => {
        const placeholder = p0box.querySelector(`#restore-img-${i}`);
        if (placeholder) {
            // Update controls to be live again (re-attach listeners if needed? 
            // onlick handlers are inline so they survive)
            // But we cloned it.
            
            // Re-make it draggable to be safe
            node.draggable = true;
            node.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', '');
                window.draggedPhoto = node;
                setTimeout(() => node.style.opacity = '0.5', 0);
            });
             node.addEventListener('dragend', (e) => {
                node.style.opacity = '1';
                window.draggedPhoto = null;
            });
            
            placeholder.replaceWith(node);
        }
    });
    
    closeRawMode();
    
    // 4. Trigger Pagination Loop
    currentPageIndex = 0;
    triggerPagination();
    updatePaginationDisplay();
}

// --- New Aesthetic Features ---
let inkMode = false;
let candleMode = false;

function toggleInkMode() {
    inkMode = !inkMode;
    document.body.classList.toggle('ink-imperfection', inkMode);
    const btn = document.getElementById('inkBtn');
    btn.style.background = inkMode ? 'rgba(255,255,255,0.3)' : '';
}

function toggleCandle() {
    candleMode = !candleMode;
    document.body.classList.toggle('candle-active', candleMode);
    const btn = document.getElementById('candleBtn');
    btn.style.background = candleMode ? 'rgba(255,255,255,0.3)' : '';
    
    if (candleMode) {
        document.addEventListener('mousemove', updateCandlePos);
        // Also listen for typing to move candle to cursor
        document.addEventListener('keydown', updateCandleToCaret);
        document.addEventListener('click', updateCandleToCaret);
        document.addEventListener('input', updateCandleToCaret);
    } else {
        document.removeEventListener('mousemove', updateCandlePos);
        document.removeEventListener('keydown', updateCandleToCaret);
        document.removeEventListener('click', updateCandleToCaret);
        document.removeEventListener('input', updateCandleToCaret);
    }
}

function setCandle(x, y) {
    document.documentElement.style.setProperty('--light-x', x + 'px');
    document.documentElement.style.setProperty('--light-y', y + 'px');
}

function updateCandlePos(e) {
    if (!candleMode) return;
    setCandle(e.clientX, e.clientY);
}

function updateCandleToCaret() {
    if (!candleMode) return;
    // Allow a small delay for UI to update caret position
    setTimeout(() => {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            // If rect is 0 (cursor), getClientRects might help, or use span
            if (rect.width === 0 && rect.height === 0) {
                // Try getClientRects
                 const rects = range.getClientRects();
                 if (rects.length > 0) {
                     const r = rects[0];
                     setCandle(r.left, r.top + r.height/2);
                     return;
                 }
            }
            // Valid rect
            if (rect.top !== 0 || rect.left !== 0) {
                 setCandle(rect.left, rect.top + rect.height/2);
            }
        }
    }, 10);
}

// --- Ink Zoom Logic ---
function updateInkScale() {
    const filter = document.querySelector('#ink-bleed feDisplacementMap');
    if(!filter) return;
    // Base scale is 3.0 (Stronger Default).
    const ratio = window.devicePixelRatio || 1;
    const newScale = 3.0 / Math.max(1, ratio * 0.8); 
    filter.setAttribute('scale', newScale);
}

let resizeTimeout;
window.addEventListener('resize', () => {
    updateInkScale();
    updateGridScale();
    
    // Re-paginate on resize as page dimensions might change (vh units)
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        triggerPagination();
    }, 500);
});
// Interval to catch zoom changes that don't trigger resize
setInterval(() => {
    updateInkScale();
    updateGridScale();
}, 1000);

// Handle Alt Key for Shortcuts Display
document.addEventListener('keydown', (e) => {
    if (e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight') {
        document.getElementById('shortcutInfoBar').classList.add('visible');
    }
});
document.addEventListener('keyup', (e) => {
    if (e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight') {
        document.getElementById('shortcutInfoBar').classList.remove('visible');
    }
});
// Safety for lost focus
window.addEventListener('blur', () => {
     document.getElementById('shortcutInfoBar').classList.remove('visible');
});

// Init
window.addEventListener('load', () => {
     attachListeners(document.querySelector('.content')); // Attach to first page
    // Initialize initial observer for page 0
    window.addEventListener('load', () => {
         const p0 = document.getElementById('page-0');
         if(p0) {
             const c = p0.querySelector('.content');
             if(c) observer.observe(c, { childList: true, subtree: true });
         }
         
         // Project System Init or Fallback
         if(typeof initProjects === 'function') initProjects();
         else restoreFromLocal();
    });
     restoreCustomColors();
     
     // Enforce Single View Default State visually
     if(isSingleView) {
         const bk = document.getElementById('bookContainer');
         if (bk) bk.classList.add('single-view');
     }
     
     updatePaginationDisplay();
     // Re-attach listeners to restored pages
     document.querySelectorAll('.content').forEach(attachListeners);
     
     // Selection Context Listener
     document.addEventListener('selectionchange', handleSelectionContext);
     document.addEventListener('keydown', handleGlobalShortcuts);
});

function handleSelectionContext() {
    const sel = window.getSelection();
    const panel = document.getElementById('contextPanel');
    
    if (sel.toString().trim().length > 0 && !sel.isCollapsed) {
        // Show panel
        panel.classList.add('visible');
    } else {
        panel.classList.remove('visible');
    }
}

// --- Image Upload ---
let savedRange = null;

function triggerImageUpload() {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        let r = sel.getRangeAt(0);
        let container = r.commonAncestorContainer;
        if (container.nodeType === 3) container = container.parentNode;
        
        if (container.closest('.content')) {
            savedRange = r.cloneRange();
        }
    }
    document.getElementById('imgInput').click();
}

function handleImageUpload(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            if (savedRange) {
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(savedRange);
            }
            insertPhoto(e.target.result);
        };
        reader.readAsDataURL(input.files[0]);
    }
    input.value = ''; // Reset
}

function insertPhoto(src) {
    const img = document.createElement('img');
    img.src = src;
    img.className = 'vintage-photo';
    
    const frame = document.createElement('div');
    frame.className = 'photo-frame';
    frame.appendChild(img);
    
    const wrapper = document.createElement('div');
    wrapper.className = 'photo-wrapper';
    wrapper.contentEditable = false;
    
    // Random slight rotation for natural look
    const rot = (Math.random() * 4 - 2).toFixed(1);
    frame.style.setProperty('--rotation', `${rot}deg`);
    
    // Controls
    // We append controls to 'frame' now so they move WITH the image and are inside its hover area cleanly
    // But if we append to frame, they will rotate with frame.
    // If we keep in wrapper, we need 'photo-controls' to position absolute relative to wrapper.
    // My CSS change set them to top:5px right:5px. Relative to what?
    // .photo-wrapper has position:relative.
    // .photo-frame also has position:relative.
    // If controls are in wrapper, they sit on top of frame (z-index 100).
    // This is correct.
    const ctrls = document.createElement('div');
    ctrls.className = 'photo-controls';
    ctrls.innerHTML = `
        <button class="photo-btn" onclick="movePhoto(this, -1)" title="بالا">▲</button>
        <button class="photo-btn" onclick="movePhoto(this, 1)" title="پایین">▼</button>
        <button class="photo-btn" onclick="deletePhotoWrapper(this)" title="حذف" style="color:#c00; font-weight:bold;">×</button>
    `;
    
    // Caption
    const caption = document.createElement('div');
    caption.className = 'photo-caption';
    caption.contentEditable = true;
    caption.spellcheck = false;
    
    // Double click to edit caption (avoids conflict with drag)
    frame.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        caption.classList.add('editing');
        caption.focus();
    });
    
    caption.addEventListener('blur', () => {
        caption.classList.remove('editing');
        // Auto text dir
        if(caption.innerText.trim().length > 0) {
             // Check first char for direction? 
             // Usually centralized is fine for short captions
        }
        triggerPagination(); // Save state
    });
    
    // Prevent drag when editing text
    caption.addEventListener('mousedown', (e) => {
        if(caption.classList.contains('editing')) e.stopPropagation();
    });

    frame.appendChild(img);
    frame.appendChild(caption);
    
    wrapper.appendChild(frame);
    wrapper.appendChild(ctrls);
    
    // Drag and Drop Logic
    wrapper.draggable = true;
    wrapper.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', ''); // Required for Firefox
        window.draggedPhoto = wrapper;
        setTimeout(() => wrapper.style.opacity = '0.5', 0);
    });
    wrapper.addEventListener('dragend', (e) => {
        wrapper.style.opacity = '1';
        window.draggedPhoto = null;
    });

    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        let range = sel.getRangeAt(0);
        range.deleteContents();
        
        // Ensure we are inside .content
        let container = range.commonAncestorContainer;
        if(container.nodeType === 3) container = container.parentNode;
        const contentNode = container.closest('.content');
        if(!contentNode) {
            alert('لطفا داخل صفحه کلیک کنید'); return;
        }

        // Insert
        range.insertNode(wrapper);
        
        // Add spacer after
        const spacer = document.createElement('div');
        spacer.innerHTML = '<br>'; 
        range.setStartAfter(wrapper);
        range.insertNode(spacer);
        
        range.selectNodeContents(spacer);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        
        triggerPagination();
    }
}

function movePhoto(btn, dir) {
    const wrapper = btn.closest('.photo-wrapper');
    const parent = wrapper.parentNode;
    if (dir === -1) { // Up
        const prev = wrapper.previousElementSibling;
        if (prev) parent.insertBefore(wrapper, prev);
    } else { // Down
        const next = wrapper.nextElementSibling;
        if (next) {
            // unexpected behavior with insertBefore next sibling
            // if next is the last one
            if (next.nextElementSibling) parent.insertBefore(wrapper, next.nextElementSibling);
            else parent.appendChild(wrapper);
        }
    }
    triggerPagination();
}

function deletePhotoWrapper(target) {
    const wrapper = target.classList.contains('photo-wrapper') ? target : target.closest('.photo-wrapper');
    if (!wrapper) return;
    // Save state
    lastDeletedNode = wrapper;
    lastDeletedParent = wrapper.parentNode;
    lastDeletedSibling = wrapper.nextSibling;
    
    wrapper.remove();
    showUndoToast();
    triggerPagination();
    saveToLocal(true);
}

function customUndo() {
    if (lastDeletedNode && lastDeletedParent) {
        if (lastDeletedSibling) {
            lastDeletedParent.insertBefore(lastDeletedNode, lastDeletedSibling);
        } else {
            lastDeletedParent.appendChild(lastDeletedNode);
        }
        // Reset
        lastDeletedNode = null;
        lastDeletedParent = null;
        hideUndoToast();
        triggerPagination();
        saveToLocal(true);
    } else {
        document.execCommand('undo');
    }
}

function handleGlobalShortcuts(e) {
    const code = e.code;
    const panel = document.getElementById('contextPanel');
    
    // Undo shortcut
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        customUndo();
        return;
    }
    
    // Priority 1: Context Shortcuts (1, 2, 3)
    // Using e.code 'Digit1' works regardless of keyboard layout (Persian/English)
    if (panel.classList.contains('visible') && !e.altKey && !e.ctrlKey) {
         if (code === 'Digit1' || code === 'Numpad1') { e.preventDefault(); formatStyle('bold'); return; }
         if (code === 'Digit2' || code === 'Numpad2') { e.preventDefault(); applyClass('dialogue-style'); return; }
         if (code === 'Digit3' || code === 'Numpad3') { e.preventDefault(); applyClass('poetry-style'); return; }
    }
    
    // Global Toggles (Alt based)
    if (e.altKey) {
        // Prevent default browser behavior for Alt combinations if matched
        
        // Note: e.key might be Persian char, so we use e.code.
        // Q=KeyQ, W=KeyW... etc. standard QWERTY layout
        
        switch(code) {
            case 'KeyI': e.preventDefault(); toggleInkMode(); break;       // Ink
            case 'KeyC': e.preventDefault(); toggleCandle(); break;        // Candle
            case 'KeyP': e.preventDefault(); triggerImageUpload(); break;  // Photo
            case 'KeyR': e.preventDefault(); openRawMode(); break;         // Raw
            case 'KeyQ': e.preventDefault(); toggleLowQuality(); break;    // Quality
            case 'ArrowLeft': e.preventDefault(); nextPage(); break;       // Next
            case 'ArrowRight': e.preventDefault(); prevPage(); break;      // Prev
        }
    }
    
    // Save (Ctrl + S)
    if ((e.ctrlKey || e.metaKey) && code === 'KeyS') {
        e.preventDefault();
        saveFile();
    }
    
    // Shortcuts Modal (?)
    if (code === 'F1') {
        e.preventDefault();
        alert('میانبرهای صفحه کلید:\n\nAlt + I : جوهر\nAlt + C : شمع\nAlt + P : افزودن عکس\nAlt + R : متن خام\nAlt + Q : کیفیت پایین\nAlt + چپ/راست : ورق زدن\nاعداد ۱-۳ : استایل متن');
    }
}

// --- Alt Key Visibility Toggle & Shortcut Blocking ---
document.addEventListener('keydown', (e) => {
    // Prevent browser menu focus on Alt press
    if (e.key === 'Alt') {
        e.preventDefault(); 
        document.querySelectorAll('.controls').forEach(c => c.classList.add('force-visible'));
    }
    // Also prevent default for Alt+Key combinations if they aren't caught by handleGlobalShortcuts
    // causing browser menu interactions
    if (e.altKey && e.key !== 'Alt') {
        // We let specific shortcuts pass through via handleGlobalShortcuts (which runs on same event or earlier)
        // But handleGlobalShortcuts is attached later? No, it's attached via document.addEventListener.
        // We should be careful not to block OS level criticals like Alt+Tab (browser won't let us anyway)
    }
});
document.addEventListener('keyup', (e) => {
    if (e.key === 'Alt') {
        document.querySelectorAll('.controls').forEach(c => c.classList.remove('force-visible'));
    }
});

// --- Grid View Logic ---
function toggleGridView() {
    const modal = document.getElementById('gridOverview');
    const isActive = modal.classList.contains('active');
    
    if (isActive) {
        modal.classList.remove('active');
    } else {
        renderGrid();
        modal.classList.add('active');
    }
}

function renderGrid() {
    const container = document.getElementById('gridContainer');
    if (!container) return;
    container.innerHTML = '';
    
    const pages = getAllPages();
    pages.forEach((p, index) => {
        try {
            const thumb = document.createElement('div');
            thumb.className = 'grid-thumb';
            if (index === currentPageIndex) thumb.classList.add('current');
            thumb.onclick = () => {
                  scrollToPage(index);
                 toggleGridView();
            };
            
            const num = document.createElement('div');
            num.className = 'grid-page-num';
            num.innerText = toPersianDigits(index + 1);
            thumb.appendChild(num);
            
            const scaler = document.createElement('div');
            scaler.className = 'thumb-scaler';
            const contentEl = p.querySelector('.content');
            if (contentEl) {
                const contentClone = contentEl.cloneNode(true);
                // Clean up IDs
                contentClone.removeAttribute('id');
                contentClone.querySelectorAll('*').forEach(el => el.removeAttribute('id'));

                applyThumbScale(contentClone);

                scaler.appendChild(contentClone);
            }
            
            thumb.appendChild(scaler);
            container.appendChild(thumb);
        } catch (e) {
            console.error('Grid thumb error:', e);
        }
    });
}

function applyThumbScale(contentEl) {
    if (!contentEl) return;
    const ratio = window.devicePixelRatio || 1;
    const baseScale = 0.25;
    const scale = baseScale / Math.max(1, ratio);
    const size = 100 / scale;

    contentEl.style.transform = `scale(${scale})`;
    contentEl.style.transformOrigin = 'top left';
    contentEl.style.width = `${size}%`;
    contentEl.style.height = `${size}%`;
}

function updateGridScale() {
    document.querySelectorAll('.thumb-scaler .content').forEach(applyThumbScale);
}


// Initialize when page loads
window.addEventListener('load', () => {
    const p0 = document.getElementById('page-0');
    if(p0) {
        const c = p0.querySelector('.content');
        if(c) {
             attachListeners(c);
             observer.observe(c, { childList: true, subtree: true });
        }
    }
    
    if(typeof initProjects === 'function') initProjects();
    else if (typeof restoreFromLocal === 'function') restoreFromLocal();
    
    if (typeof restoreCustomColors === 'function') restoreCustomColors();
    
    if(isSingleView) {
        const bk = document.getElementById('bookContainer');
        if (bk) bk.classList.add('single-view');
    }
    
    updatePaginationDisplay();
    const book = document.getElementById('bookContainer');
    if (book) {
        book.addEventListener('scroll', () => {
            window.requestAnimationFrame(updateCurrentPageFromScroll);
        });
    }
    document.querySelectorAll('.content').forEach(attachListeners);
    
    document.addEventListener('selectionchange', handleSelectionContext);
    if (typeof handleGlobalShortcuts === 'function') {
        document.addEventListener('keydown', handleGlobalShortcuts);
    }
});