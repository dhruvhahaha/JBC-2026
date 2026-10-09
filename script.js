/* --- Runtime Environment Detection --- */
const mediaMatches = (query) => !!(window.matchMedia && window.matchMedia(query).matches);
const prefersReducedMotion = mediaMatches('(prefers-reduced-motion: reduce)');
// Phones & tablets: primary input is a finger with no hover. These get native scrolling (no Lenis).
const isTouchDevice = mediaMatches('(hover: none) and (pointer: coarse)');
// Breakpoint used for lighter mobile animation paths (matches the CSS mobile breakpoint)
const MOBILE_QUERY = '(max-width: 768px), (hover: none) and (pointer: coarse)';

/* --- CDN Library Guards ---
   If GSAP / ScrollTrigger fail to load (offline, blocked CDN), install a tiny no-op shim so the
   rest of this file still wires up menus, modals & carousels, and nothing stays hidden. */
const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
if (!hasGSAP) {
    const chain = new Proxy(function () {}, { get: () => () => chain, apply: () => chain });
    window.gsap = {
        registerPlugin() {}, set() {}, to() {}, from() {}, fromTo() {},
        timeline: () => chain,
        ticker: { add() {}, remove() {}, lagSmoothing() {} },
        matchMedia: () => ({ add(query, fn) { if (mediaMatches(query)) fn(); }, revert() {} })
    };
    window.ScrollTrigger = {
        config() {}, create() {}, refresh() {}, update() {}, getAll: () => [],
        addEventListener() {}, removeEventListener() {}
    };
    document.documentElement.classList.add('no-gsap');
}

gsap.registerPlugin(ScrollTrigger);
// Ignore iOS/Android URL-bar show/hide resizes (height-only) so pinned sections don't re-measure mid-scroll
ScrollTrigger.config({ ignoreMobileResize: true });

/* --- Smooth Scrolling (Lenis) — desktop pointer devices only ---
   Touch devices keep native momentum scrolling, which is smoother and cheaper on mobile GPUs. */
let lenis = null;
if (hasGSAP && typeof window.Lenis !== 'undefined' && !isTouchDevice && !prefersReducedMotion) {
    lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 1,
        syncTouch: false,
        touchMultiplier: 2,
        infinite: false
    });
    window.lenis = lenis;

    // Lenis writes scrollTop every frame; CSS `scroll-behavior: smooth` would smooth those writes a second time
    document.documentElement.style.scrollBehavior = 'auto';

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });
}

// Optimal GSAP lag smoothing: prevents jumpy catch-up animation freezes
gsap.ticker.lagSmoothing(500, 33);

/* --- Scroll Lock (mobile menu & modals) ---
   Locks the page without position:fixed so the reader's scroll position is never lost (iOS-safe). */
const scrollLockOwners = new Set();
let lockedScrollY = 0;

function lockScroll(owner) {
    if (scrollLockOwners.has(owner)) return;
    if (scrollLockOwners.size === 0) {
        lockedScrollY = window.scrollY || window.pageYOffset || 0;
        document.documentElement.style.overflow = 'hidden';
        if (lenis) lenis.stop();
    }
    scrollLockOwners.add(owner);
}

function unlockScroll(owner) {
    if (!scrollLockOwners.delete(owner) || scrollLockOwners.size > 0) return;
    document.documentElement.style.overflow = '';
    // Guard against any stylesheet lock that collapsed the page while locked
    if (Math.abs((window.scrollY || 0) - lockedScrollY) > 2) {
        window.scrollTo({ top: lockedScrollY, behavior: 'instant' });
    }
    if (lenis) {
        lenis.scrollTo(lockedScrollY, { immediate: true, force: true });
        lenis.start();
    }
}

/* --- Scroll-linked UI: progress bar & navbar state (one passive, rAF-throttled listener) --- */
let cachedProgressBar = null;
let cachedNavbar = null;
let scrollTicking = false;
let maxScroll = 1;
let navIsScrolled = null;

function measureMaxScroll() {
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
}

function renderScrollUI() {
    scrollTicking = false;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    if (cachedProgressBar) {
        const progress = Math.min(1, Math.max(0, scrollY / maxScroll));
        cachedProgressBar.style.transform = `scaleX(${progress.toFixed(4)})`;
    }

    const shouldBeScrolled = scrollY > 50;
    if (cachedNavbar && shouldBeScrolled !== navIsScrolled) {
        navIsScrolled = shouldBeScrolled;
        cachedNavbar.classList.toggle('scrolled', shouldBeScrolled);
    }
}

function requestScrollUI() {
    if (!scrollTicking) {
        scrollTicking = true;
        requestAnimationFrame(renderScrollUI);
    }
}

/* --- Lazy Background Images ---
   index.html ships photos as data-lazy-bg="url('…')" (no inline background-image) so off-screen images
   never compete with the hero. These helpers resolve them; the observers are wired up after DOM ready. */
const supportsLazyBg = 'IntersectionObserver' in window;

function loadDeferredBackground(el) {
    const bg = el.getAttribute('data-lazy-bg');
    if (bg) {
        el.style.backgroundImage = bg;
        el.removeAttribute('data-lazy-bg');
    }
}

function loadDeferredBackgroundsIn(root) {
    if (!root) return;
    if (root.hasAttribute && root.hasAttribute('data-lazy-bg')) loadDeferredBackground(root);
    root.querySelectorAll('[data-lazy-bg]').forEach(loadDeferredBackground);
}

// Modal portraits: layer the full-res photo over the card's already-cached thumbnail,
// so the dialog never opens on a blank panel while the large image downloads.
function getThumbBackground(el) {
    if (!el) return '';
    const bg = el.getAttribute('data-lazy-bg') || el.style.backgroundImage;
    if (bg && bg !== 'none') return bg;
    const img = el.querySelector && el.querySelector('img');
    return img && img.currentSrc ? `url("${img.currentSrc}")` : '';
}

function layeredBackground(fullRes, thumbEl) {
    const thumb = getThumbBackground(thumbEl);
    return thumb && thumb !== fullRes ? `${fullRes}, ${thumb}` : fullRes;
}

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {

    /* --- Scroll-linked UI wiring --- */
    cachedProgressBar = document.querySelector('.scroll-progress-bar');
    cachedNavbar = document.querySelector('.navbar');
    if (cachedProgressBar) {
        // Compositor-only progress updates (scaleX) instead of animating width (layout)
        cachedProgressBar.style.width = '100%';
        cachedProgressBar.style.transformOrigin = '0 50%';
        cachedProgressBar.style.transition = 'none';
        cachedProgressBar.style.willChange = 'transform';
        cachedProgressBar.style.transform = 'scaleX(0)';
    }
    measureMaxScroll();
    renderScrollUI();
    window.addEventListener('scroll', requestScrollUI, { passive: true });
    window.addEventListener('resize', () => { measureMaxScroll(); requestScrollUI(); }, { passive: true });
    ScrollTrigger.addEventListener('refresh', () => { measureMaxScroll(); requestScrollUI(); });

    /* --- Hero Section Animation --- */
    const heroCounters = document.querySelectorAll('.hero-stat-number');

    function runHeroCounters(animate) {
        heroCounters.forEach(counter => {
            const target = parseInt(counter.getAttribute('data-target'), 10) || 0;
            const suffix = counter.getAttribute('data-suffix') || '';
            if (!animate) {
                counter.textContent = target.toLocaleString() + suffix;
                return;
            }
            const duration = target > 100 ? 1800 : 1100;
            const startTime = performance.now();

            function updateCounter(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // Ease out cubic
                const eased = 1 - Math.pow(1 - progress, 3);
                const current = Math.round(eased * target);
                counter.textContent = current.toLocaleString() + suffix;
                if (progress < 1) requestAnimationFrame(updateCounter);
            }
            requestAnimationFrame(updateCounter);
        });
    }

    if (!hasGSAP || prefersReducedMotion) {
        // Show everything immediately; no motion
        const heroLine = document.querySelector('.jbc-hero-line');
        if (heroLine) heroLine.style.width = '120px';
        runHeroCounters(false);
    } else {
        // The hero title, subtitle, CTAs and stats are painted visible straight from HTML/CSS (they are the LCP),
        // so nothing here starts from opacity 0. Only the accent rule draws in and the counters tick up.
        gsap.to('.jbc-hero-line', {
            width: '120px',
            duration: 1.1,
            delay: 0.15,
            ease: "power3.inOut"
        });
        runHeroCounters(true);
    }

    // Parallax on hero video — desktop only (scrubbing a full-screen video layer costs frames on phones)
    if (!prefersReducedMotion) {
        gsap.matchMedia().add('(min-width: 769px) and (hover: hover)', () => {
            gsap.to('.hero-video', {
                yPercent: 30,
                ease: "none",
                scrollTrigger: {
                    trigger: ".hero",
                    start: "top top",
                    end: "bottom top",
                    scrub: true
                }
            });
        });
    }

    /* --- Hero Background Video Instant Autoplay Engine --- */
    const heroVideo = document.querySelector('.hero-video');
    if (heroVideo) {
        // Enforce DOM properties required by iOS WebKit and Android Chrome
        heroVideo.muted = true;
        heroVideo.defaultMuted = true;
        heroVideo.playsInline = true;

        // The source (data-src-mobile / data-src-desktop) is attached by the inline loader in index.html after
        // window "load"; the listeners below start playback once that data arrives.

        const attemptPlay = () => {
            const playPromise = heroVideo.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    // Autoplay blocked by device policy (e.g. iOS Low Power Mode, Android Battery Saver, data limit)
                    // Start playback immediately on the very first touch, scroll, or click
                    const unlockAutoplay = () => {
                        heroVideo.play().catch(() => {});
                        ['touchstart', 'touchend', 'pointerdown', 'scroll', 'click', 'keydown'].forEach(ev => {
                            window.removeEventListener(ev, unlockAutoplay);
                        });
                    };
                    ['touchstart', 'touchend', 'pointerdown', 'scroll', 'click', 'keydown'].forEach(ev => {
                        window.addEventListener(ev, unlockAutoplay, { passive: true, once: true });
                    });
                });
            }
        };

        if (heroVideo.readyState >= 2) {
            attemptPlay();
        } else {
            heroVideo.addEventListener('loadeddata', attemptPlay, { once: true });
            heroVideo.addEventListener('canplay', attemptPlay, { once: true });
        }

        // Pause video when out of viewport or when tab is hidden to save battery & GPU
        let isHeroInView = true;
        if ('IntersectionObserver' in window) {
            const heroSection = document.getElementById('hero');
            if (heroSection) {
                const heroObserver = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        isHeroInView = entry.isIntersecting;
                        if (isHeroInView && !document.hidden) {
                            heroVideo.play().catch(() => {});
                        } else {
                            heroVideo.pause();
                        }
                    });
                }, { threshold: 0.05 });
                heroObserver.observe(heroSection);
            }
        }

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                heroVideo.pause();
            } else if (isHeroInView) {
                heroVideo.play().catch(() => {});
            }
        });
    }

    /* --- About Section Narrative --- */
    const chapters = document.querySelectorAll('.chapter');
    
    chapters.forEach(chapter => {
        gsap.fromTo(chapter, 
            { opacity: 0, y: 50 },
            { 
                opacity: 1, 
                y: 0,
                duration: 1.5,
                ease: "power3.out",
                scrollTrigger: {
                    trigger: chapter,
                    start: "top 80%",
                }
            }
        );
    });

    // Image Mask Reveals
    const mediaReveals = document.querySelectorAll('.media-reveal');
    mediaReveals.forEach(reveal => {
        gsap.fromTo(reveal.querySelector('.image-placeholder'),
            { clipPath: "inset(10% 10% 10% 10%)", filter: "grayscale(100%)" },
            {
                clipPath: "inset(0% 0% 0% 0%)",
                filter: "grayscale(0%)",
                duration: 1.5,
                ease: "power3.inOut",
                scrollTrigger: {
                    trigger: reveal,
                    start: "top 70%",
                    end: "bottom 80%",
                    scrub: 1
                }
            }
        );
    });



    /* --- Living Architectural Museum Exhibition Engine --- */
    const museumSection = document.getElementById('legacy');
    const museumViewport = document.querySelector('.museum-sticky-viewport');
    const museumStage = document.getElementById('museum-stage');
    const museumChapters = document.querySelectorAll('.museum-chapter');
    const museumCanvas = document.getElementById('legacy-museum-canvas');
    const crimsonThread = document.getElementById('crimson-thread');
    const finaleMonolithInner = document.getElementById('finale-monolith-inner');
    const finaleEngravedTitle = document.getElementById('finale-engraved-title');
    const portalBeam = document.getElementById('portal-beam');

    if (museumSection && museumViewport && museumChapters.length > 0 && !hasGSAP) {
        // GSAP unavailable: present the exhibition as a simple readable stack instead of an empty pinned stage
        museumSection.style.height = 'auto';
        museumViewport.style.height = 'auto';
        museumViewport.style.padding = '6rem 0 4rem';
        ['.museum-floating-header', '.museum-3d-stage'].forEach(sel => {
            const el = museumViewport.querySelector(sel);
            if (el) el.style.position = 'relative';
        });
        museumChapters.forEach(chapter => {
            Object.assign(chapter.style, {
                position: 'relative', top: 'auto', left: 'auto', transform: 'none',
                opacity: '1', margin: '2.5rem auto 0', maxHeight: 'none'
            });
        });
    } else if (museumSection && museumViewport && museumChapters.length > 0) {

        /* 1. Atmospheric Volumetric & Ambient Particle Canvas Engine (60 FPS) */
        if (museumCanvas) {
            const ctx = museumCanvas.getContext('2d');
            let mw = 0, mh = 0;
            let dustParticles = [];
            let animFrameId = null;
            let isMuseumVisible = false;
            let scrollProgress = 0;

            function resizeMuseumCanvas() {
                mw = museumCanvas.width = museumViewport.clientWidth;
                mh = museumCanvas.height = museumViewport.clientHeight;
            }

            class DustParticle {
                constructor() {
                    this.reset();
                }

                reset() {
                    this.x = (Math.random() - 0.5) * mw * 2.2;
                    this.y = (Math.random() - 0.5) * mh * 2.2;
                    this.z = Math.random() * 1200 + 1;
                    this.size = Math.random() * 1.8 + 0.6;
                    this.isCrimson = Math.random() < 0.75; // 75% JBC Crimson, 25% Soft Charcoal Accent
                    this.speed = Math.random() * 0.4 + 0.2;
                }

                update() {
                    const dynamicSpeed = this.speed + scrollProgress * 12;
                    this.z -= dynamicSpeed;
                    if (this.z <= 0) {
                        this.reset();
                        this.z = 1200;
                    }
                }

                draw() {
                    const cx = mw / 2;
                    const cy = mh / 2;
                    const scale = 450 / this.z;
                    const px = this.x * scale + cx;
                    const py = this.y * scale + cy;

                    if (px >= 0 && px <= mw && py >= 0 && py <= mh) {
                        const alpha = Math.min(1, (1200 - this.z) / 900) * (this.isCrimson ? 0.65 : 0.75);
                        const radius = Math.max(0.5, this.size * scale * 0.8);

                        ctx.beginPath();
                        ctx.arc(px, py, radius, 0, Math.PI * 2);
                        ctx.fillStyle = this.isCrimson 
                            ? `rgba(204, 0, 0, ${alpha * 0.85})` 
                            : `rgba(30, 30, 35, ${alpha * 0.25})`;
                        ctx.fill();
                    }
                }
            }

            // Particles only on desktop pointer devices; phones/tablets & reduced-motion skip the canvas entirely
            const particlesEnabled = () => !prefersReducedMotion && !mediaMatches(MOBILE_QUERY);
            let lastCanvasWidth = -1;

            function initMuseumParticles() {
                dustParticles = [];
                if (!particlesEnabled()) {
                    if (animFrameId) cancelAnimationFrame(animFrameId);
                    animFrameId = null;
                    if (mw || mh) {
                        // Release the canvas backing store
                        museumCanvas.width = 0;
                        museumCanvas.height = 0;
                        mw = mh = 0;
                    }
                    return;
                }
                resizeMuseumCanvas();
                lastCanvasWidth = window.innerWidth;
                const particleCount = 35;
                for (let i = 0; i < particleCount; i++) {
                    dustParticles.push(new DustParticle());
                }
            }

            function renderMuseumParticles() {
                animFrameId = null;
                if (!isMuseumVisible || dustParticles.length === 0) return;
                ctx.clearRect(0, 0, mw, mh);

                for (let i = 0; i < dustParticles.length; i++) {
                    dustParticles[i].update();
                    dustParticles[i].draw();
                }
                animFrameId = requestAnimationFrame(renderMuseumParticles);
            }

            function startMuseumParticles() {
                isMuseumVisible = true;
                if (!animFrameId) renderMuseumParticles();
            }

            function stopMuseumParticles() {
                isMuseumVisible = false;
                if (animFrameId) cancelAnimationFrame(animFrameId);
                animFrameId = null;
            }

            // Only rebuild on real width changes — ignore mobile URL-bar (height-only) resizes
            let resizeTimer = null;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    if (particlesEnabled() && window.innerWidth === lastCanvasWidth) {
                        resizeMuseumCanvas();
                        return;
                    }
                    initMuseumParticles();
                    if (isMuseumVisible) startMuseumParticles();
                }, 200);
            }, { passive: true });

            initMuseumParticles();

            ScrollTrigger.create({
                trigger: museumSection,
                start: "top bottom",
                end: "bottom top",
                onUpdate: (self) => {
                    scrollProgress = self.progress;
                    // Living Crimson Thread Intensity
                    if (crimsonThread) {
                        const threadOpacity = 0.15 + (self.progress * 0.7);
                        crimsonThread.style.opacity = threadOpacity;
                    }
                },
                onEnter: startMuseumParticles,
                onLeave: stopMuseumParticles,
                onEnterBack: startMuseumParticles,
                onLeaveBack: stopMuseumParticles
            });
        }

        /* 2. GSAP ScrollTrigger Evolving Architectural Camera Trajectory (High-Performance No-Blur) */
        const isMobileMuseum = mediaMatches(MOBILE_QUERY);
        const museumTL = gsap.timeline({
            scrollTrigger: {
                trigger: museumSection,
                start: "top top",
                end: "bottom bottom",
                pin: ".museum-sticky-viewport",
                // Tighter scrub on touch so the exhibit tracks the finger instead of trailing behind it
                scrub: isMobileMuseum ? 0.3 : 0.6,
                // Native (non-Lenis) scrolling applies the pin a frame late; anticipate it to avoid a jump
                anticipatePin: isMobileMuseum ? 1 : 0,
                invalidateOnRefresh: true
            }
        });

        // Camera depths: shallower on phones so cards never balloon past the screen edges while fading out
        const depth = isMobileMuseum
            ? { enter: 'translate3d(-50%, -50%, -700px) scale(0.88)', hold: 'translate3d(-50%, -50%, 15px) scale(1)',
                exit: 'translate3d(-50%, -51%, 90px) scale(1.02)' }
            : { enter: 'translate3d(-50%, -50%, -1200px) scale(0.8)', hold: 'translate3d(-50%, -50%, 30px) scale(1)',
                exit: 'translate3d(-50%, -52%, 240px) scale(1.05)' };

        museumChapters.forEach((chapter, idx) => {
            const yearAttr = chapter.getAttribute('data-year');
            const isFinale = yearAttr === 'finale';

            if (!isFinale) {
                // Phase 1: Clean scale & opacity entrance (avoids heavy GPU blur shaders).
                // The first milestone is already in place when the pin starts, so the stage is never empty.
                if (idx === 0) {
                    gsap.set(chapter, { transform: 'translate3d(-50%, -50%, 0px) scale(1)', opacity: 1 });
                } else {
                    museumTL.fromTo(chapter,
                        { transform: depth.enter, opacity: 0 },
                        {
                            transform: 'translate3d(-50%, -50%, 0px) scale(1)',
                            opacity: 1,
                            duration: 1.4,
                            ease: "power2.out"
                        }
                    );
                }

                // Milestone specific 3D architectural transformations
                if (yearAttr === '2024') {
                    const pLeft = chapter.querySelector('.panel-left');
                    const pRight = chapter.querySelector('.panel-right');
                    if (pLeft && pRight) {
                        museumTL.fromTo([pLeft, pRight],
                            { opacity: 0, scale: 0.85 },
                            { opacity: 1, scale: 1, duration: 0.8, ease: "power2.out" },
                            "-=0.6"
                        );
                    }
                } else if (yearAttr === '2026') {
                    const photoCubes = chapter.querySelectorAll('.orbiting-photo-cube');
                    if (photoCubes.length > 0) {
                        museumTL.fromTo(photoCubes,
                            { opacity: 0, scale: 0.7 },
                            { opacity: 1, scale: 1, stagger: 0.08, duration: 0.9, ease: "power2.out" },
                            "-=0.8"
                        );
                    }
                }

                // Phase 2: Hold & comfortably view milestone in focus
                museumTL.to(chapter, { transform: depth.hold, duration: 1.1, ease: "none" })

                // Phase 3: Smooth exit
                .to(chapter,
                    {
                        transform: depth.exit,
                        opacity: 0,
                        duration: 1.0,
                        ease: "power2.in"
                    },
                    "-=0.1"
                );

            } else {
                // Finale Monolith Node: 180° Monolith Flip & Light Beam Portal Activation
                museumTL.fromTo(chapter,
                    { transform: depth.enter, opacity: 0 },
                    {
                        transform: 'translate3d(-50%, -50%, 0px) scale(1)',
                        opacity: 1,
                        duration: 1.4,
                        ease: "power2.out"
                    }
                );

                // Monolith 180° Rotation to reveal 'Voices That Shaped JBC'
                if (finaleMonolithInner) {
                    museumTL.to(finaleMonolithInner, {
                        rotateY: 180,
                        duration: 1.2,
                        ease: "power2.inOut",
                        onStart: () => {
                            if (finaleEngravedTitle) finaleEngravedTitle.classList.add('illuminated');
                        }
                    });
                }

                // Activate Portal Light Beam
                if (portalBeam) {
                    museumTL.to(portalBeam, {
                        // A soft glow behind the title; at full strength the beam flooded the card and hid the text
                        width: '70%',
                        opacity: 0.28,
                        duration: 0.8,
                        ease: "power2.out",
                        onStart: () => {
                            portalBeam.classList.add('open');
                        }
                    });
                }

                // Hold the revealed monolith until the pin releases (no blank pinned screen at the end)
                museumTL.to(chapter, { transform: depth.hold, duration: 0.8, ease: "none" });
            }
        });

        /* 3D Mouse Parallax Architecture Tilt (Throttled 60FPS, Desktop Only) */
        let mouseParallaxTicking = false;
        let cachedMuseumRect = null;

        museumViewport.addEventListener('mouseenter', () => {
            cachedMuseumRect = museumViewport.getBoundingClientRect();
        }, { passive: true });

        museumViewport.addEventListener('mousemove', (e) => {
            if (window.innerWidth < 768) return; // Skip on mobile to save CPU
            if (!mouseParallaxTicking) {
                mouseParallaxTicking = true;
                requestAnimationFrame(() => {
                    if (!cachedMuseumRect) cachedMuseumRect = museumViewport.getBoundingClientRect();
                    const mouseX = (e.clientX - cachedMuseumRect.left - cachedMuseumRect.width / 2) / (cachedMuseumRect.width / 2);
                    const mouseY = (e.clientY - cachedMuseumRect.top - cachedMuseumRect.height / 2) / (cachedMuseumRect.height / 2);

                    const rotX = -mouseY * 3.5;
                    const rotY = mouseX * 3.5;

                    if (museumStage) {
                        gsap.to(museumStage, {
                            rotateX: rotX,
                            rotateY: rotY,
                            duration: 0.6,
                            ease: "power2.out",
                            overwrite: "auto"
                        });
                    }
                    mouseParallaxTicking = false;
                });
            }
        }, { passive: true });

        museumViewport.addEventListener('mouseleave', () => {
            cachedMuseumRect = null;
            if (museumStage) {
                gsap.to(museumStage, {
                    rotateX: 0,
                    rotateY: 0,
                    duration: 0.8,
                    ease: "power2.out",
                    overwrite: "auto"
                });
            }
        }, { passive: true });
    }

    /* --- Grand Roster Reveal Animation --- */
    const rosterCardsList = document.querySelectorAll('.roster-card');
    if (rosterCardsList.length > 0) {
        gsap.fromTo(rosterCardsList,
            { opacity: 0, y: 35 },
            {
                opacity: 1,
                y: 0,
                duration: 0.8,
                stagger: 0.08,
                ease: "power2.out",
                scrollTrigger: {
                    trigger: ".roster-grid",
                    start: "top 85%"
                }
            }
        );
    }

    /* --- Speaker Profile Overlay --- */
    const speakerOverlay = document.getElementById('speaker-overlay');
    const closeProfileBtn = document.querySelector('.close-profile');
    const viewSessionBtns = document.querySelectorAll('.view-session-btn');

    // Speaker & Moderator Data
    const speakerData = {
        'manhar_garegrat': {
            name: 'Mr. Manhar Garegrat',
            role: 'SPEAKER',
            session: '2022-23 • Web 3 & Cryptocurrencies',
            designation: 'Former Executive Director & Chief Of Staff',
            company: 'CoinDCX',
            bio: "From having gained experience as Digital Marketing Manager at The Hyatt Hotels for Pune, Goa, Mumbai, Hyderabad & Kochi, Mr Garegrat moved on to be the Vice President, Digital Initiatives at ZebPay and Executive Director & Chief of Staff at CoinDCX. Currently the Former Executive Director & Chief of Staff at CoinDCX.",
            quote: "Web 3 & Cryptocurrencies",
            linkedin: "https://www.linkedin.com/in/manhargaregrat/",
            instagram: "https://www.instagram.com/manhargaregrat/",
            image: 'url("speaker_manhar_garegrat.webp")'
        },
        'tushar_pradhan': {
            name: 'Mr. Tushar Pradhan',
            role: 'SPEAKER',
            session: '2022-23 • Investing during turbulent times',
            designation: 'CIO',
            company: 'HSBC Asset Management',
            bio: "He began his career in the United States where he got his MBA degree from the Barney School of Business, Hartford, Conn. and then worked in insurance and asset management. He returned to India in 1995 and has worked for HDFC Ltd, HDFC Asset Management and AIG Investments with more than 20 years of experience.",
            quote: "Investing during turbulent times",
            linkedin: "https://www.linkedin.com/in/tushar-pradhan-1068b810/",
            instagram: "",
            image: 'url("speaker_tushar_pradhan.webp")'
        },
        'kunal_bajaj': {
            name: 'Mr. Kunal Bajaj',
            role: 'SPEAKER',
            session: '2022-23 • Entrepreneurship and startups - the opportunity in India',
            designation: 'Head of Capital Network',
            company: 'Blume Ventures',
            bio: "Kunal Bajaj, Venture Capitalist, Head of Capital Network at Blume Ventures, Business Head, Wealth Management at Mobikwik and Founder & CEO Clearfunds (acquired by MobiKwik).",
            quote: "Entrepreneurship and startups - the opportunity in India",
            linkedin: "https://www.linkedin.com/in/kuna1bajaj/",
            instagram: "https://www.instagram.com/kuna1bajaj/",
            image: 'url("speaker_kunal_bajaj.webp")'
        },
        'anirudh_rangaraj': {
            name: 'Mr. Anirudh Rangaraj',
            role: 'SPEAKER',
            session: '2022-23 • Will AI & Metaverse change the world or kill it?',
            designation: 'Manager - Consulting',
            company: 'Deloitte',
            bio: "He is a seasoned professional with more than a decade of experience in strategy consulting, product development and implementation. He has invested close to 10,000 hours of consulting for C-suite across digital strategy, product implementation roadmaps, and process standardisation.",
            quote: "Will AI & Metaverse change the world or kill it?",
            linkedin: "https://www.linkedin.com/in/anirudhrangaraj3/",
            instagram: "",
            image: 'url("speaker_anirudh_rangaraj.webp")'
        },
        'ian_almedia': {
            name: 'Mr. Ian Almedia',
            role: 'SPEAKER',
            session: '2022-23 • Will AI & Metaverse change the world or kill it?',
            designation: 'Founder',
            company: 'Jinxed Network',
            bio: "Ian Almedia, Co-Founder of Stitched Network and Founder of Jinxed Network, assists businesses in conceptualising their vision and values to communicate with target audiences through design, technology, and creative marketing solutions.",
            quote: "Will AI & Metaverse change the world or kill it?",
            linkedin: "https://www.linkedin.com/in/ianalmeida/",
            instagram: "",
            image: 'url("speaker_ian_almedia.webp")'
        },
        'alok_churiwala': {
            name: 'Mr. Alok Churiwala',
            role: 'SPEAKER',
            session: '2022-23 • Demystifying Mutual Funds',
            designation: 'Managing Director',
            company: 'Churiwala Securities Pvt Ltd',
            bio: "Managing Director at Churiwala Securities Pvt Ltd, Former Director and Vice Chairman at Bombay Stock Exchange (BSE) Brokers Forum. An esteemed financial markets expert.",
            quote: "Demystifying Mutual Funds",
            linkedin: "https://www.linkedin.com/in/alok-churiwala-712b556/",
            instagram: "",
            image: 'url("speaker_alok_churiwala.webp")'
        },
        'snehil_khanor': {
            name: 'Mr. Snehil Khanor',
            role: 'SPEAKER',
            session: '2023-24 • Building Modern Consumer Platforms',
            designation: 'Co-Founder & CEO',
            company: 'TrulyMadly',
            bio: "He is the Co-founder and CEO at TrulyMadly. With his sharp strategic acumen and consumer-first mindset, Snehil has transformed TrulyMadly into one of India\u2019s leading dating and relationship apps. His expertise spans product development, growth strategies, and consumer behavior.",
            quote: "Building Modern Consumer Platforms",
            linkedin: "https://www.linkedin.com/in/snehilkhanor/",
            instagram: "https://www.instagram.com/snehilkhanor/",
            image: 'url("speaker_snehil_khanor.webp")'
        },
        'avelo_roy': {
            name: 'Mr. Avelo Roy',
            role: 'SPEAKER',
            session: '2023-24 • Startup Ecosystem & Venture Creation',
            designation: 'Managing Director',
            company: 'Kolkata Ventures',
            bio: "MD at Kolkata Ventures, 4-time TEDx Speaker and Guest Lecturer at IITs & IIMs. Avelo has built multimillion-dollar businesses in the US and India and mentored thousands of entrepreneurs.",
            quote: "Startup Ecosystem & Venture Creation",
            linkedin: "https://www.linkedin.com/in/avelo/",
            instagram: "",
            image: 'url("speaker_avelo_roy.webp")'
        },
        'ashish_limaye': {
            name: 'Mr. Ashish Limaye',
            role: 'SPEAKER',
            session: '2023-24 • Creative Tech & Immersive Media',
            designation: 'CEO - APAC',
            company: 'HappyFinish',
            bio: "A pioneering creative technologist and CEO - APAC at HappyFinish, leading transformative AR, VR, and AI-driven creative experiences for global marquee brands.",
            quote: "Creative Tech & Immersive Media",
            linkedin: "https://www.linkedin.com/in/ashishlimaye/",
            instagram: "https://www.instagram.com/ashishlimaye/",
            image: 'url("speaker_ashish_limaye.webp")'
        },
        'ryan_gomes': {
            name: 'Mr. Ryan Gomes',
            role: 'SPEAKER',
            session: '2023-24 • Design Thinking & Visual Identity',
            designation: 'Lead Designer & Creative Director',
            company: 'Creative Media',
            bio: "A seasoned creative leader known for his forward-thinking design philosophies, brand storytelling, and visual strategy for modern youth audiences.",
            quote: "Design Thinking & Visual Identity",
            linkedin: "",
            instagram: "",
            image: 'url("speaker_ryan_gomes.webp")'
        },
        'tushar_pradhan_24': {
            name: 'Mr. Tushar Pradhan',
            role: 'SPEAKER',
            session: '2023-24 • Navigating Macro Cycles',
            designation: 'Former CIO',
            company: 'HSBC Asset Management',
            bio: "Senior investment strategist and financial markets veteran with over two decades of experience managing institutional funds across HDFC, AIG, and HSBC.",
            quote: "Navigating Macro Cycles",
            linkedin: "https://www.linkedin.com/in/tushar-pradhan-1068b810/",
            instagram: "",
            image: 'url("speaker_tushar_pradhan_24.webp")'
        },
        'khushnooma_kapadia': {
            name: 'Mrs. Khushnooma Kapadia',
            role: 'SPEAKER',
            session: '2024-25 • Breaking The Glass Ceiling',
            designation: 'Vice President, Marketing South Asia',
            company: 'Marriott International',
            bio: "She is a remarkable individual whose passion, dedication, and vision have shaped her successful journey. With a background rich in experience across brand building and hospitality, she has consistently demonstrated exceptional leadership and a deep commitment to making a difference.",
            quote: "Breaking The Glass Ceiling",
            linkedin: "https://www.linkedin.com/in/khushnoomakapadia/",
            instagram: "",
            image: 'url("speaker_khushnooma_kapadia.webp")'
        },
        'darayus_mehta': {
            name: 'Mr. Darayus Mehta',
            role: 'SPEAKER',
            session: '2024-25 • A brand new story, winning the hearts in the hyper connected world',
            designation: 'Founder Director',
            company: 'Unified Collaborations Services LLP',
            bio: "He has over a decade of experience driving innovations at Reliance Communications, leading Product Life Cycle Management for Voice, Cloud Telephony, and Collaboration Tools. He has transformed enterprise communication through groundbreaking innovations like live conferencing surgeries and CEO town halls.",
            quote: "A brand new story, winning the hearts in the hyper connected world",
            linkedin: "https://www.linkedin.com/in/darayus-mehta-82451811/",
            instagram: "",
            image: 'url("speaker_darayus_mehta.webp")'
        },
        'mehul_gupta': {
            name: 'Mr. Mehul Gupta',
            role: 'SPEAKER',
            session: '2024-25 • Digital Disruption & Agency Growth',
            designation: 'CEO & Co-Founder',
            company: 'SoCheers',
            bio: "With a passion for innovation and a keen eye for emerging trends, Mehul has been at the forefront of transforming brands and digital marketing strategies. As a dynamic entrepreneur, he has successfully built SoCheers into a thriving agency that delivers results-driven solutions for clients across industries.",
            quote: "Digital Disruption & Agency Growth",
            linkedin: "https://www.linkedin.com/in/mehulguptasc/",
            instagram: "",
            image: 'url("speaker_mehul_gupta.webp")'
        },
        'rahul_agarwal': {
            name: 'Mr. Rahul Agarwal',
            role: 'SPEAKER',
            session: '2024-25 • Global Supply Chains & Logistics',
            designation: 'CEO',
            company: 'Express Global Logistics',
            bio: "With his visionary leadership, Mr. Agarwal has been instrumental in transforming Express Global Logistics into a trusted name in global freight and transportation solutions. Under his guidance, the company has expanded its reach, innovated operations, and consistently delivered excellence in service.",
            quote: "Global Supply Chains & Logistics",
            linkedin: "https://www.linkedin.com/in/rahul-agrawal-8734758/",
            instagram: "",
            image: 'url("speaker_rahul_agarwal.webp")'
        },
        'hitarth_dadia': {
            name: 'Mr. Hitarth Dadia',
            role: 'SPEAKER',
            session: '2024-25 • Influencer Economy & Digital Culture',
            designation: 'CEO & Partner',
            company: 'NoFiltr Group',
            bio: "As a seasoned leader in the digital marketing space, Hitarth has been at the forefront of helping brands engage with their audiences in new and impactful ways. With a focus on creativity, technology, and measurable results, Nofiltr Group has made its mark as a trailblazer in the industry.",
            quote: "Influencer Economy & Digital Culture",
            linkedin: "https://www.linkedin.com/in/hitarth-dadia-95667a137/",
            instagram: "",
            image: 'url("speaker_hitarth_dadia.webp")'
        },
        'karan_rana': {
            name: 'Mr. Karan Rana',
            role: 'SPEAKER',
            session: '2024-25 • Hyperlocal Growth & Product Marketing',
            designation: 'Senior Product Marketing Manager',
            company: 'Swiggy',
            bio: "With a strong background in marketing strategy and project management, Karan plays a pivotal role in driving Swiggy's innovative marketing campaigns and customer-centric initiatives. His expertise in building brand awareness and executing large-scale projects has contributed significantly to Swiggy's growth.",
            quote: "Hyperlocal Growth & Product Marketing",
            linkedin: "https://www.linkedin.com/in/karanrana1/",
            instagram: "",
            image: 'url("speaker_karan_rana.webp")'
        },
        'mili_paul': {
            name: 'Mrs. Mili Paul',
            role: 'SPEAKER',
            session: '2024-25 • Workshop with CDSL (BSE Subsidiary)',
            designation: 'DDSL Resource Person & SEBI Empanelled Trainer',
            company: 'BSE / CDSL',
            bio: "With over 14 years of experience in Academics, Finance & Accounts, she has motivated over 35,000 participants across India to become financially literate and investment conscious.",
            quote: "Workshop with CDSL (BSE Subsidiary)",
            linkedin: "",
            instagram: "",
            image: 'url("speaker_mili_paul.webp")'
        },
        'vishal_shah': {
            name: 'Mr. Vishal Shah',
            role: 'SPEAKER',
            session: '2024-25 • The paradox of banking',
            designation: 'Vice President',
            company: 'Barclays Bank',
            bio: "With extensive experience in the banking industry, Mr. Shah brings a wealth of knowledge on financial strategies, innovation, and the evolving landscape of global banking. He offers invaluable insights into the balance between risk, regulation, and profitability.",
            quote: "The paradox of banking",
            linkedin: "https://www.linkedin.com/in/vishal-shah-64b0147/",
            instagram: "",
            image: 'url("speaker_vishal_shah.webp")'
        },
        'dharmarajan': {
            name: 'Mr. Dharmarajan Sankara Subramanian',
            role: 'MODERATOR',
            session: '2025-26 • Banking on the Future',
            designation: 'Founder & Managing Director',
            company: 'Impactsure Technologies',
            bio: "With decades of experience across banking, financial services and technology, Mr. Dharmarajan has been at the forefront of driving innovation, digital transformation and sustainable growth within the financial ecosystem.",
            quote: "Banking on the Future",
            linkedin: "https://www.linkedin.com/in/dharmarajan/",
            instagram: "",
            image: 'url("speaker_dharmarajan.webp")'
        },
        'sahil_makhija': {
            name: 'Sahil Makhija',
            role: 'MODERATOR',
            session: '2025-26 • A Seat at the Table',
            designation: 'Founder of Headbanger’s Kitchen & Media Host',
            company: 'Media & Gastronomy',
            bio: "Through his work across digital media, gourmet comfort food and experiential gastronomy, he has built a distinctive perspective on how culinary content, bold flavors and community shape the way people connect and engage.",
            quote: "A Seat at the Table",
            linkedin: "",
            instagram: "https://www.instagram.com/headbangerskitchen/",
            image: 'url("speaker_sahil_makhija.webp")'
        },
        'keki_mistry': {
            name: 'Mr. Keki Mistry',
            role: 'SPEAKER',
            session: '2025-26 • Banking on the Future',
            designation: 'Interim Chairman',
            company: 'HDFC Bank',
            bio: "Keki Mistry, one of the most respected voices in India’s financial ecosystem, has played a defining role in shaping the country’s banking and corporate landscape through decades of visionary leadership and strategic foresight.",
            quote: "Banking on the Future",
            linkedin: "",
            instagram: "",
            image: 'url("speaker_keki_mistry.webp")'
        },
        'arjit_garg': {
            name: 'Mr. Arjit Garg',
            role: 'MODERATOR',
            session: '2025-26 • Navigating Risk in Your 20’s',
            designation: 'India’s Youngest SEBI Registered Research Analyst',
            company: 'Financial Markets',
            bio: "Known for his work in equity research, investor education, and financial markets, Arjit has developed a strong perspective on how young individuals can approach investing, decision-making, and risk management.",
            quote: "Navigating Risk in Your 20’s",
            linkedin: "https://www.linkedin.com/in/arjitgarg-/",
            instagram: "",
            image: 'url("speaker_arjit_garg.webp")'
        },
        'annkur_khosla': {
            name: 'Ms. Annkur Khosla',
            role: 'MODERATOR',
            session: '2025-26 • The New Language of Luxury',
            designation: 'Founder & Principal Architect',
            company: 'Annkur Khosla Design Studio',
            bio: "Through her work across luxury, wellness and experiential design, Annkur has built a distinctive perspective on how spaces, stories and experiences shape the way people connect, engage and belong.",
            quote: "The New Language of Luxury",
            linkedin: "https://www.linkedin.com/in/annkur-khosla-46372398/",
            instagram: "https://www.instagram.com/annkurkhosla/",
            image: 'url("speaker_annkur_khosla.webp")'
        },
        'simran_advani': {
            name: 'Ms. Simran Advani',
            role: 'PANELIST',
            session: '2025-26 • A Seat at the Table',
            designation: 'Founder of Nova & Co-Founder of Pastel',
            company: 'Nova & Pastel Patisserie',
            bio: "Inspired by Italy’s rich dessert culture and driven by a passion for craftsmanship, Simran transformed an unconventional journey into one of Mumbai’s most distinctive dessert ventures.",
            quote: "A Seat at the Table",
            linkedin: "https://www.linkedin.com/in/simran-advani1196/",
            instagram: "https://www.instagram.com/simranadvani/",
            image: 'url("speaker_simran_advani.webp")'
        },
        'enrico_signorelli': {
            name: 'Mr. Enrico Signorelli',
            role: 'PANELIST',
            session: '2025-26 • A Seat at the Table',
            designation: 'Founder',
            company: 'MAMI Bombay',
            bio: "With a vision rooted in authenticity, creativity, and community, Enrico has built MAMI Bombay into a brand that blends indulgent food experiences with a modern dining culture.",
            quote: "A Seat at the Table",
            linkedin: "",
            instagram: "https://www.instagram.com/mamibombay/",
            image: 'url("speaker_enrico_signorelli.webp")'
        },
        'abhijeet_anand': {
            name: 'Mr. Abhijeet Anand',
            role: 'PANELIST',
            session: '2025-26 • A Seat at the Table',
            designation: 'Founder & Chief Executive Officer',
            company: 'abcoffee',
            bio: "With a disruptive and technology-driven approach to coffee retail, Abhijeet has built one of the country’s fastest growing café concepts by combining quality, convenience, and affordability.",
            quote: "A Seat at the Table",
            linkedin: "https://www.linkedin.com/in/theabhijeetanand/",
            instagram: "https://www.instagram.com/brewwithabhijeet/",
            image: 'url("speaker_abhijeet_anand.webp")'
        },
        'vik_khatwani': {
            name: 'Mr. Vik Khatwani',
            role: 'PANELIST',
            session: '2025-26 • A Seat at the Table',
            designation: 'Founder',
            company: 'Earth Café',
            bio: "Leaving behind a successful career in jewelry manufacturing, Vik transformed a personal philosophy into one of Mumbai’s most recognized plant based and gluten free café brands.",
            quote: "A Seat at the Table",
            linkedin: "https://www.linkedin.com/in/vik-khatwani-4b018b2a3/",
            instagram: "https://www.instagram.com/vik.khatwani/",
            image: 'url("speaker_vik_khatwani.webp")'
        },
        'shlok_savjani': {
            name: 'Mr. Shlok Savjani',
            role: 'PANELIST',
            session: '2025-26 • A Seat at the Table',
            designation: 'Managing Partner',
            company: 'Maroosh',
            bio: "Representing one of Mumbai’s most loved culinary brands, Shlok has played a key role in evolving Maroosh while staying true to the authenticity and flavors that built its loyal community.",
            quote: "A Seat at the Table",
            linkedin: "https://www.linkedin.com/in/shloksavjani/",
            instagram: "",
            image: 'url("speaker_shlok_savjani.webp")'
        },
        'ishaan_bahl': {
            name: 'Mr. Ishaan Bahl',
            role: 'PANELIST',
            session: '2025-26 • A Seat at the Table',
            designation: 'Founder of Khyber & 145 Café & Bar, CEO',
            company: 'RISA Hospitality',
            bio: "Blending the legacy of an iconic dining institution with the pulse of contemporary food culture, Ishaan has redefined what it means to create hospitality experiences that are timeless and relevant.",
            quote: "A Seat at the Table",
            linkedin: "https://www.linkedin.com/in/ishaan-bahl-2331b881/",
            instagram: "https://www.instagram.com/ishaanb9/",
            image: 'url("speaker_ishaan_bahl.webp")'
        },
        'yash_advani': {
            name: 'Mr. Yash Advani',
            role: 'PANELIST',
            session: '2025-26 • A Seat at the Table',
            designation: 'Founder of Maikada & Cafe Calma, Co-Founder',
            company: 'Pastel Patisserie / Shalimar Hotel',
            bio: "Rooted in the legacy of The Shalimar Hotel, Yash represents a new generation of hospitality leaders redefining meaningful dining experiences through thoughtfully curated concepts.",
            quote: "A Seat at the Table",
            linkedin: "",
            instagram: "",
            image: 'url("speaker_yash_advani.webp")'
        },
        'sankalp_kelshikar': {
            name: 'Mr. Sankalp Kelshikar',
            role: 'SPEAKER',
            session: '2025-26 • Moving India Forward',
            designation: 'Co-Founder',
            company: 'Cityflo Buses',
            bio: "With a vision to transform the everyday commute experience, Mr. Kelshikar has redefined urban mobility by building one of India’s most innovative consumer-focused transportation platforms.",
            quote: "Moving India Forward",
            linkedin: "https://www.linkedin.com/in/sankalp-kelshikar-7815a124/",
            instagram: "https://www.instagram.com/sankalpkelshikar/",
            image: 'url("speaker_sankalp_kelshikar.webp")'
        },
        'rajat_bhatia': {
            name: 'Mr. Rajat Bhatia',
            role: 'SPEAKER',
            session: '2025-26 • The New Language of Luxury',
            designation: 'Commercial Director',
            company: 'Four Seasons Mumbai',
            bio: "Known for his warmth, vision and deep understanding of modern hospitality, Rajat has been instrumental in curating world-class guest experiences that create genuine human connection.",
            quote: "The New Language of Luxury",
            linkedin: "",
            instagram: "",
            image: 'url("speaker_rajat_bhatia.webp")'
        },
        'maulik_bhansali': {
            name: 'Mr. Maulik Bhansali',
            role: 'SPEAKER',
            session: '2025-26 • Navigating Risk in Your 20’s',
            designation: 'Chief Risk Officer',
            company: 'Union Asset Management Co. Pvt. Ltd.',
            bio: "A master of foresight in India’s investment sector. Backed by a passion for financial stability and risk-reward optimization, Mr. Bhansali has played a pivotal role in institutional resilience.",
            quote: "Navigating Risk in Your 20’s",
            linkedin: "",
            instagram: "",
            image: 'url("speaker_maulik_bhansali.webp")'
        }
    };

    /* --- Profile Overlays (speaker & team): scroll lock, focus management, entrance animation --- */
    const teamOverlay = document.getElementById('team-overlay');
    const profileOverlays = [speakerOverlay, teamOverlay].filter(Boolean);
    let overlayReturnFocus = null;

    // Closed dialogs are hidden from assistive tech and removed from the tab order
    const setOverlayHidden = (overlay, hidden) => {
        overlay.setAttribute('aria-hidden', hidden ? 'true' : 'false');
        overlay.inert = hidden;
        if (hidden) overlay.setAttribute('inert', ''); else overlay.removeAttribute('inert');
    };
    profileOverlays.forEach(overlay => setOverlayHidden(overlay, !overlay.classList.contains('open')));

    function openOverlay(overlay) {
        if (!overlay) return;
        if (!overlay.classList.contains('open')) overlayReturnFocus = document.activeElement;
        // Give the open profile its own history entry so the phone's Back gesture closes it instead of leaving the site
        if (!(history.state && history.state.jbcModal)) {
            try { history.pushState({ jbcModal: overlay.id || 'overlay' }, ''); } catch (err) {}
        }
        setOverlayHidden(overlay, false);
        document.body.classList.add('modal-open');
        lockScroll(overlay.id || 'overlay');

        const rightPane = overlay.querySelector('.profile-right');
        if (rightPane) rightPane.scrollTop = 0;
        overlay.classList.add('open');

        if (!prefersReducedMotion) {
            gsap.fromTo(overlay.querySelectorAll('.profile-right > *'),
                { opacity: 0, y: 30 },
                { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, delay: 0.2, ease: "power3.out", overwrite: true }
            );
        }

        // Move focus into the dialog for keyboard & screen-reader users (without scrolling the page)
        const closeBtn = overlay.querySelector('.modal-circle-back-btn, .close-speaker-profile, .close-team-profile, .close-profile');
        if (closeBtn) {
            requestAnimationFrame(() => {
                try { closeBtn.focus({ preventScroll: true }); } catch (err) { closeBtn.focus(); }
            });
        }
    }

    function closeOverlay(overlay, fromHistory) {
        if (!overlay || !overlay.classList.contains('open')) return;
        overlay.classList.remove('open');
        // Closed by button / swipe / Escape: drop the history entry we pushed on open (its popstate is then a no-op)
        if (fromHistory !== true && history.state && history.state.jbcModal) {
            try { history.back(); } catch (err) {}
        }
        if (!profileOverlays.some(o => o.classList.contains('open'))) {
            document.body.classList.remove('modal-open');
        }
        unlockScroll(overlay.id || 'overlay');

        // Return focus to the card that opened the dialog (before hiding it, so focus never sits in an aria-hidden tree)
        const returnTo = overlayReturnFocus;
        overlayReturnFocus = null;
        if (returnTo && typeof returnTo.focus === 'function' && returnTo !== document.body) {
            try { returnTo.focus({ preventScroll: true }); } catch (err) {}
        }
        if (overlay.contains(document.activeElement)) document.activeElement.blur();
        setOverlayHidden(overlay, true);
    }

    // View Session Button click handler
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.view-session-btn');
        if (btn) {
            e.stopPropagation();
            const speakerId = btn.getAttribute('data-speaker');
            if (speakerId) openSpeakerModal(speakerId);
        }
    });

    // Ensure all external social links (LinkedIn / Instagram / Coordinators) open reliably without interference
    document.addEventListener('click', (e) => {
        const socialLink = e.target.closest('#speaker-instagram-link, #speaker-linkedin-link, #team-linkedin-link, .speaker-linkedin-btn, .speaker-instagram-btn, .coord-link.linkedin');
        if (socialLink) {
            e.stopPropagation();
            const href = socialLink.getAttribute('href');
            if (href && href !== '#' && !href.startsWith('javascript:')) {
                socialLink.setAttribute('target', '_blank');
                socialLink.setAttribute('rel', 'noopener noreferrer');
            }
        }
    });

    // Close speaker profile overlay
    document.querySelectorAll('.close-speaker-profile, .close-profile').forEach(btn => {
        btn.addEventListener('click', () => closeOverlay(speakerOverlay));
    });

    // Escape key to close overlays
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            profileOverlays.forEach(overlay => closeOverlay(overlay));
        }
    });

    // Browser / gesture Back while a profile is open closes it and keeps the visitor on the page
    window.addEventListener('popstate', () => {
        profileOverlays.forEach(overlay => closeOverlay(overlay, true));
    });

    profileOverlays.forEach(overlay => {
        const rightPane = overlay.querySelector('.profile-right');

        // Wheel over the image/side area scrolls the content pane. Wheel over the pane itself already
        // scrolls natively (data-lenis-prevent), so forwarding it too would double the distance.
        overlay.addEventListener('wheel', (e) => {
            if (rightPane && !rightPane.contains(e.target)) {
                rightPane.scrollTop += e.deltaY;
            }
        }, { passive: true });

        // Mobile pull-down-to-dismiss: only when the content pane starts at the top
        let touchStartY = 0;
        let touchStartX = 0;
        let swipeEligible = false;
        overlay.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches.length === 1) {
                touchStartY = e.touches[0].clientY;
                touchStartX = e.touches[0].clientX;
                const startedOnControl = !!e.target.closest('a, button');
                swipeEligible = !startedOnControl && (!rightPane || rightPane.scrollTop <= 5);
            } else {
                swipeEligible = false;
            }
        }, { passive: true });

        overlay.addEventListener('touchend', (e) => {
            if (!swipeEligible || !e.changedTouches || !e.changedTouches[0]) return;
            swipeEligible = false;
            const diffY = e.changedTouches[0].clientY - touchStartY;
            const diffX = Math.abs(e.changedTouches[0].clientX - touchStartX);
            const stillAtTop = !rightPane || rightPane.scrollTop <= 5;
            if (stillAtTop && diffY > 80 && diffY > diffX * 1.5) {
                closeOverlay(overlay);
            }
        }, { passive: true });
    });

    /* --- Speakers Section: Single-Line Horizontal Carousel --- */
    const accordionTrack = document.getElementById('horizontal-accordion');
    const slotPrevBtn = document.getElementById('slot-prev');
    const slotNextBtn = document.getElementById('slot-next');

    // Shared tap-vs-drag state (read by the card click handlers below)
    let isDragging = false;
    let touchDistance = 0;

    if (accordionTrack) {
        gsap.set(accordionTrack, { clearProps: "x,transform" });

        // Scroll by exactly one card (+ gap) so prev/next lands cleanly at every breakpoint
        const getCardStep = () => {
            const card = Array.from(accordionTrack.children).find(c => c.offsetWidth > 0);
            if (!card) return 380;
            const gap = parseFloat(getComputedStyle(accordionTrack).columnGap) || 0;
            return card.offsetWidth + gap;
        };

        // Prev & Next Horizontal Navigation Buttons
        if (slotPrevBtn) {
            slotPrevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                accordionTrack.scrollBy({ left: -getCardStep(), behavior: prefersReducedMotion ? 'auto' : 'smooth' });
            });
        }
        if (slotNextBtn) {
            slotNextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                accordionTrack.scrollBy({ left: getCardStep(), behavior: prefersReducedMotion ? 'auto' : 'smooth' });
            });
        }

        // Mouse drag-to-scroll (desktop). Touch uses native horizontal scrolling + scroll-snap.
        let isDown = false;
        let startX = 0;
        let startY = 0;
        let scrollLeft = 0;

        const endMouseDrag = () => {
            if (!isDown) return;
            isDown = false;
            accordionTrack.style.scrollBehavior = '';
        };

        accordionTrack.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            isDown = true;
            isDragging = false;
            startX = e.pageX;
            scrollLeft = accordionTrack.scrollLeft;
            // CSS smooth scroll-behavior would animate every scrollLeft write and make dragging feel laggy
            accordionTrack.style.scrollBehavior = 'auto';
        });

        accordionTrack.addEventListener('mouseleave', endMouseDrag);
        accordionTrack.addEventListener('mouseup', endMouseDrag);

        accordionTrack.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            const walk = (e.pageX - startX) * 1.5;
            if (Math.abs(walk) > 6) isDragging = true;
            if (!isDragging) return;
            e.preventDefault();
            accordionTrack.scrollLeft = scrollLeft - walk;
        });

        // Prevent native image/link ghost-drag from hijacking the mouse drag
        accordionTrack.addEventListener('dragstart', (e) => e.preventDefault());

        // Touch tracking to distinguish horizontal swipe from intentional tap
        accordionTrack.addEventListener('touchstart', (e) => {
            touchDistance = 0;
            isDragging = false;
            if (e.touches && e.touches[0]) {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            }
        }, { passive: true });

        accordionTrack.addEventListener('touchmove', (e) => {
            if (e.touches && e.touches[0]) {
                const diffX = Math.abs(e.touches[0].clientX - startX);
                const diffY = Math.abs(e.touches[0].clientY - startY);
                touchDistance = Math.max(touchDistance, diffX, diffY);
            }
        }, { passive: true });
    }

    function openSpeakerModal(speakerId) {
        const data = speakerData[speakerId];
        if (data && speakerOverlay) {
            const rolePill = document.querySelector('.profile-role-pill');
            const sessionPill = document.querySelector('.profile-session-pill');
            const nameEl = document.querySelector('.profile-name');
            const desigEl = document.querySelector('.profile-designation');
            const compEl = document.querySelector('.profile-company');
            const bioEl = document.querySelector('#speaker-overlay .bio-text');
            const quoteEl = document.querySelector('.modal-speaker-quote');
            const imgContainer = document.querySelector('#speaker-overlay .profile-image-container');

            if (rolePill) rolePill.innerText = data.role;
            if (sessionPill) sessionPill.innerText = `SESSION: ${data.session.toUpperCase()}`;
            if (nameEl) nameEl.innerText = data.name;
            if (desigEl) desigEl.innerText = data.designation;
            if (compEl) compEl.innerText = data.company;
            if (bioEl) bioEl.innerText = data.bio;
            if (quoteEl) quoteEl.innerText = data.quote;
            if (imgContainer) {
                const thumbEl = document.querySelector(`.accordion-item[data-speaker="${speakerId}"] .speaker-crop`);
                imgContainer.style.backgroundImage = layeredBackground(data.image, thumbEl);
            }

            // Social buttons: only verified profile links are shown; no search-URL fallbacks
            const linkedinLink = document.getElementById('speaker-linkedin-link');
            const instagramLink = document.getElementById('speaker-instagram-link');
            const setSocialLink = (link, url) => {
                if (!link) return;
                if (url) {
                    link.href = url;
                    link.style.display = 'inline-flex';
                } else {
                    link.removeAttribute('href');
                    link.style.display = 'none';
                }
            };
            setSocialLink(linkedinLink, data.linkedin);
            setSocialLink(instagramLink, data.instagram);
            const socialRow = speakerOverlay.querySelector('.profile-social-row');
            if (socialRow) socialRow.style.display = (data.linkedin || data.instagram) ? 'flex' : 'none';

            openOverlay(speakerOverlay);
        }
    }

    const speakerCards = document.querySelectorAll('.speakers-hall .accordion-item');
    speakerCards.forEach(card => {
        card.addEventListener('click', (e) => {
            // The "View Full Profile" button is handled by the delegated listener above
            if (e.target.closest('.view-session-btn, a')) return;
            // Only trigger if not dragging or swiping
            if (isDragging || touchDistance > 8) {
                isDragging = false;
                touchDistance = 0;
                return;
            }
            const speakerId = card.getAttribute('data-speaker');
            if (speakerId) openSpeakerModal(speakerId);
        });
    });

    /* --- Speaker Session Filter Tabs --- */
    const speakerFilterBtns = document.querySelectorAll('.speaker-session-filters .filter-btn');

    speakerFilterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            speakerFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.getAttribute('data-filter');
            const trackHeightBefore = accordionTrack ? accordionTrack.offsetHeight : 0;
            const shownCards = [];

            speakerCards.forEach(card => {
                const session = card.getAttribute('data-session');
                if (filter === 'all' || session === filter) {
                    card.style.display = 'flex';
                    shownCards.push(card);
                } else {
                    card.style.display = 'none';
                }
            });

            // Newly shown cards must never sit grey: resolve their photos now
            shownCards.forEach(loadDeferredBackgroundsIn);

            // Only the cards that land in view need the entrance animation
            if (!prefersReducedMotion && shownCards.length > 0) {
                gsap.fromTo(shownCards.slice(0, 6),
                    { opacity: 0, scale: 0.95 },
                    { opacity: 1, scale: 1, duration: 0.4, ease: "power2.out", overwrite: true, clearProps: "opacity,transform" }
                );
            }

            if (accordionTrack) {
                accordionTrack.scrollTo({ left: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
                // Re-measure scroll triggers only if the carousel height (and so the page) actually changed
                if (accordionTrack.offsetHeight !== trackHeightBefore) ScrollTrigger.refresh();
            }
        });
    });

    /* --- Team Profile Overlay --- */
    const closeTeamProfileBtn = document.querySelector('.close-team-profile');
    
    const teamData = {
        'rakhi': {
            name: 'Dr. Rakhi Sharma',
            designation: 'Faculty Advisor & Director of AICTE Programs',
            linkedin: 'https://www.linkedin.com/in/drrakhisharma',
            about: 'She is a passionate academic, Director of AICTE Programs, and lifelong learner with a PhD in Venture Capital Management. With over 18 years in education, she is known for her leadership, resilience, and inspiring presence. She is deeply committed to empowering people with creativity, confidence, and innovation.',
            achievements: [
                'Director of AICTE Programs.',
                'PhD in Venture Capital Management.',
                'Over 18 years of experience in higher education, leadership, and inspiring mentorship.',
                'Faculty Advisor, Jai Hind Business Conclave.',
                'Deeply committed to empowering students with creativity, confidence, and innovation.'
            ],
            quote: '"Empowering people with creativity, confidence, and innovation drives true leadership."',
            image: 'url("Rakhi maam.webp")'
        },
        'prateek': {
            name: 'Mr. Prateek Kumar',
            designation: 'Faculty, BBA department',
            linkedin: 'https://www.linkedin.com/in/prateek-kumar-817095114',
            about: 'With over 7 years of experience in academia, research, and institutional innovation, he specializes in building entrepreneurial mindsets, empowering students with real-world business frameworks, and bridging the gap between education and industry.',
            achievements: [
                'Faculty, BBA department, Jai Hind College.',
                'Over 7 years of experience in academia, research, and institutional innovation.',
                'Specializes in building entrepreneurial mindsets and real-world business frameworks.',
                'Instrumental in bridging the gap between higher education and corporate industry.'
            ],
            quote: '"Bridging education and industry empowers students to build real-world business frameworks."',
            image: 'url("Prateek kumar sir.webp")'
        },
        // CORE TEAM PROFILES
        'hamza_2025': {
            name: 'Hamza Bamboat',
            designation: 'Student Secretary',
            about: 'Leading the Jai Hind Business Conclave, driving organizational growth, strategic partnerships, and delivering impactful corporate discourse across every vertical.',
            achievements: [
                'Student Secretary, Jai Hind Business Conclave.',
                'Expanded inter-collegiate partnerships across major Mumbai institutions.',
                'Pioneered strategic corporate alliances for national reach.'
            ],
            quote: '"Leadership is about empowering teams to turn vision into impact."',
            image: 'url("Hamza Bamboat.webp")'
        },
        'karishma_2025': {
            name: 'Karishma Peswani',
            designation: 'Student Joint Secretary',
            about: 'Pivotal in managing core operations, cross-department coordination, and maintaining structural execution across all conclave events for JBC.',
            achievements: [
                'Student Joint Secretary, Jai Hind Business Conclave.',
                'Coordinated operational workflows across student departments.',
                'Maintained structural excellence throughout event planning and execution.'
            ],
            quote: '"Operational harmony is the foundation of every memorable event."',
            image: 'url("Karishma Peswani.webp")'
        },
        'hussain_2025': {
            name: 'Hussain Mamawala',
            designation: 'Student Joint Secretary Operations',
            about: 'Managed ground logistics, venue setup, and operational security for the conclave.',
            achievements: [
                'Student Joint Secretary Operations, Jai Hind Business Conclave.',
                'Handled ground logistics and venue safety.',
                'Coordinated real-time event schedules.'
            ],
            quote: '"Precision in operations ensures smooth execution under pressure."',
            image: 'url("Hussain Formal photo.webp")'
        },
        'tanisha_2025': {
            name: 'Tanisha Hemdev',
            designation: 'Student Joint Secretary Outreach',
            about: 'Coordinated operational workflows, volunteer management, and stage execution during JBC.',
            achievements: [
                'Student Joint Secretary Outreach, Jai Hind Business Conclave.',
                'Supervised volunteer teams and back-stage management.',
                'Ensured seamless transition between sessions.'
            ],
            quote: '"Consistency and teamwork drive operational success."',
            image: 'url("Tanisha Hemdev.webp")'
        },
        'sanaa_2025': {
            name: 'Sanaa Punwani',
            designation: 'Student Joint Secretary Media',
            about: 'Directed media production, creative branding, and visual storytelling across digital and physical conclave platforms.',
            achievements: [
                'Student Joint Secretary Media, Jai Hind Business Conclave.',
                'Curated digital media assets and video campaigns.',
                'Managed press releases and digital presence.'
            ],
            quote: '"Visual storytelling gives identity and voice to every milestone."',
            image: 'url("Sanaa Punwani.webp")'
        },
        'husain_u_2025': {
            name: 'Husain Udaipurwala',
            designation: 'Student Joint Secretary Legal & Finance',
            about: 'Managed financial budgeting, sponsorship accounting, and legal compliance for JBC.',
            achievements: [
                'Student Joint Secretary Legal & Finance, Jai Hind Business Conclave.',
                'Oversaw conclave budget auditing and legal contracts.',
                'Ensured financial compliance across all event verticals.'
            ],
            quote: '"Financial integrity and legal compliance build institutional trust."',
            image: 'url("HUSAIN ZOHAIR UDAIPURWALA.webp")'
        },
        'keravi_2025': {
            name: 'Kairavi Javeria',
            designation: 'Student Joint Secretary Creatives',
            about: 'Led the creative design team, curating visual aesthetics, stage design, and branding materials for JBC.',
            achievements: [
                'Student Joint Secretary Creatives, Jai Hind Business Conclave.',
                'Designed stage aesthetics and visual identity.',
                'Supervised graphic design and editorial layouts.'
            ],
            quote: '"Creativity is intelligence having fun in design."',
            image: 'url("Kairavi Javeria.webp")'
        },
        'aditi_2025': {
            name: 'Aditi Thite',
            designation: 'Student Joint Secretary Events',
            about: 'Curated and executed high-impact speaker sessions, panel discussions, and inter-collegiate business competitions for JBC.',
            achievements: [
                'Student Joint Secretary Events, Jai Hind Business Conclave.',
                'Managed speaker sessions with leading CEOs and investors.',
                'Organized flagship business competitions.'
            ],
            quote: '"Meticulous planning and passion turn events into unforgettable experiences."',
            image: 'url("aaditi thite.webp")'
        },
        'janhavi_2025': {
            name: 'Janhavi Pokharkar',
            designation: 'Student Joint Secretary Hospitality',
            about: 'Overseeing supply chain, venue logistics, and hospitality infrastructure for speakers and delegates during JBC.',
            achievements: [
                'Student Joint Secretary Hospitality, Jai Hind Business Conclave.',
                'Managed hospitality transport and guest accommodations.',
                'Streamlined supply chain logistics.'
            ],
            quote: '"Seamless logistics elevate guest comfort and event workflow."',
            image: 'url("Janhavi Pokharkar New.webp")'
        },
        'zara_2025': {
            name: 'Zara Zatkal',
            designation: 'Student Joint Secretary Public Relations',
            about: 'Headed public relations, media communications, and delegate engagement, expanding JBC\'s national visibility and institutional relations.',
            achievements: [
                'Student Joint Secretary Public Relations, Jai Hind Business Conclave.',
                'Handled external media communications.',
                'Fostered student engagement across national colleges.'
            ],
            quote: '"Authentic relationships and strong storytelling build enduring legacy brands."',
            image: 'url("Zara Zatakia.webp")'
        },
        'sidhveer_2025': {
            name: 'Sidhveer Wadhwa',
            designation: 'Student Joint Secretary Marketing',
            about: 'Spearheaded marketing strategies, brand partnerships, and audience acquisition for the conclave, expanding delegate enrollment exponentially.',
            achievements: [
                'Student Joint Secretary Marketing, Jai Hind Business Conclave.',
                'Drove marketing campaigns reaching over 10,000+ students.',
                'Forged strategic brand sponsorships across retail and finance.'
            ],
            quote: '"Strategic marketing transforms great ideas into widespread movements."',
            image: 'url("Sidhveer Wadhwa.webp")'
        },
        'khwahish_2024': {
            name: 'Khwahish Joshi',
            designation: 'Student Secretary & President (JBC 2024–25)',
            about: 'Led the landmark 3rd edition of the Jai Hind Business Conclave ("The Monopoly Edition"), scaling JBC to over 5,000 delegates. Driven by a passion to expand the conclave\'s stature, she spearheaded flagship competitions like Zero Rupees 3.0 and secured marquee keynotes from Marriott South Asia, Barclays, Swiggy, and Express Global Logistics.',
            achievements: [
                'Scaled JBC to over 5,000 delegates and 25+ participating colleges.',
                'Curated and executed the flagship Zero Rupee 3.0 startup challenge.',
                'Earned national media coverage across 8 major national syndicates including Hindustan Times.'
            ],
            quote: '"JBC was more than just a college event to me; it was a calling. Every moment of preparation was a labor of love."',
            image: 'url("core_2024_khwahish_joshi.webp")'
        },
        'marina_2024': {
            name: 'Marina Kapadia',
            designation: 'Deputy Student Secretary (JBC 2024–25)',
            about: 'As Deputy Student Secretary for JBC 2024–25, Marina coordinated across 10 departmental wings and 22 student coordinators to deliver seamless cross-functional execution.',
            achievements: [
                'Directed logistical workflow for 2 days of intensive keynote panels and student competitions.',
                'Facilitated high-profile speaker hospitality and protocol.'
            ],
            quote: '"True leadership lies in empowering every member of the team to shine."',
            image: 'url("core_2024_marina_kapadia.webp")'
        },
        'dhanashri_2024': {
            name: 'Dhanashri Vetekar',
            designation: 'Student Joint Secretary • Marketing (JBC 2024–25)',
            about: 'Directed marketing strategy, attendee outreach, and campaign momentum for JBC 2024–25.',
            achievements: [
                'Executed full-scale attendee acquisition campaign.',
                'Expanded outreach across collegiate networks in Maharashtra.'
            ],
            quote: '"Marketing is about crafting stories that resonate and inspire action."',
            image: 'url("core_2024_dhanashri_venkat.webp")'
        },
        'jharna_2024': {
            name: 'Jharna Mandowara',
            designation: 'Vice President • Events (JBC 2024–25)',
            about: 'Led stage coordination, keynote itinerary management, and delegate programming.',
            achievements: [
                'Managed execution of flagship competitions and speaker panels.',
                'Ensured seamless stage transitions and itinerary flow.'
            ],
            quote: '"Great events are remembered by the feelings they evoke."',
            image: 'url("core_2024_jharna_mandowara.webp")'
        },
        'krishiv_2024': {
            name: 'Krishv Peswani',
            designation: 'Vice President • Public Relations (JBC 2024–25)',
            about: 'Spearheaded institutional relations, speaker liaison, and delegate public relations.',
            achievements: [
                'Facilitated marquee speaker relations and corporate liaison.',
                'Amplified institutional reach and collegiate delegate relations.'
            ],
            quote: '"Public relations is the bridge of trust between an idea and the community."',
            image: 'url("core_2024_krishiv_peswani.webp")'
        },
        'ansh_2024': {
            name: 'Ansh Jumani',
            designation: 'Vice President • Brand Relations (JBC 2024–25)',
            about: 'Led corporate sponsorship acquisitions and brand alignment for JBC 2024–25.',
            achievements: [
                'Forged partnerships with premier enterprise sponsors.',
                'Expanded corporate networking opportunities for delegates.'
            ],
            quote: '"Strong partnerships turn ambitious visions into achievable realities."',
            image: 'url("core_2024_ansh_jumani.webp")'
        },
        'mythili_2024': {
            name: 'Mythili Meher',
            designation: 'Vice President • Creatives (JBC 2024–25)',
            about: 'Crafted the visual aesthetic, thematic identity, and digital design for the Monopoly Edition.',
            achievements: [
                'Designed all conclave promotional assets and theme branding.',
                'Curated stage backdrops, branding, and print collateral.'
            ],
            quote: '"Creativity gives an event its soul and identity."',
            image: 'url("core_2024_mythili_meher.webp")'
        },
        'tanish_2024': {
            name: 'Tanish Shah',
            designation: 'Vice President • Executions (JBC 2024–25)',
            about: 'Directed floor operations, crowd flow, and on-ground technical execution.',
            achievements: [
                'Supervised operations across multi-hall tracks simultaneously.',
                'Ensured high safety and seamless coordination during the conclave.'
            ],
            quote: '"Flawless execution is the highest form of respect for our guests."',
            image: 'url("core_2024_tanish_shah.webp")'
        },
        'jatin_2024': {
            name: 'Jatin Tolani',
            designation: 'Vice President • Logistics (JBC 2024–25)',
            about: 'Oversaw inventory, equipment transportation, vendor management, and hospitality logistics.',
            achievements: [
                'Coordinated comprehensive logistics for 5,000+ delegates.',
                'Managed vendor relationships and stage materials setup.'
            ],
            quote: '"Behind every great moment is invisible, tireless logistical precision."',
            image: 'url("core_2024_jatin_tolani.webp")'
        },
        'sheikha_2024': {
            name: 'Sheikha Fathma',
            designation: 'Vice President • Media (JBC 2024–25)',
            about: 'Managed digital media coverage, videography, photography, and post-event media production.',
            achievements: [
                'Captured moments across 2 dynamic days of panels and workshops.',
                'Produced recap media and social content driving high impressions.'
            ],
            quote: '"Moments pass, but captured stories last forever."',
            image: 'url("core_2024_sheikha_fathma.webp")'
        },
        'ananya_2024': {
            name: 'Ananya Pitroda',
            designation: 'Vice President • Legal & Finance (JBC 2024–25)',
            about: 'Managed budgeting, contractual compliance, vendor agreements, and fiscal integrity.',
            achievements: [
                'Maintained zero-variance fiscal management across all conclave tracks.',
                'Structured legal agreements with corporate sponsors.'
            ],
            quote: '"Integrity and transparency are the bedrocks of sustainable growth."',
            image: 'url("core_2024_ananya_pitroda.webp")'
        },
        'bhavika_2023': {
            name: 'Bhavika Moolrajani',
            designation: 'Student Secretary & President (JBC 2023–24)',
            about: 'Steered the 2nd edition of JBC under the theme "Expanding Horizons", bringing together more than 3,000 delegates. Guided the conclave through critical growth phases, establishing long-term corporate associations with leaders like Kotak AMC, SBI Mutual Fund, and Dr. Vaidya\'s.',
            achievements: [
                'Expanded JBC\'s presence to a nationwide collegiate audience.',
                'Spearheaded the Empowered Ed - Tech for India initiative.',
                'Secured landmark partnerships and prominent coverage across national business outlets.'
            ],
            quote: '"The journey taught me patience, persistence, problem-solving, and the art of keeping calm when everything seems to be going wrong."',
            image: 'url("core_2023_bhavika_moolrajani.webp")'
        },
        'arnav_2023': {
            name: 'Arnav Mirchandani',
            designation: 'Deputy Student Secretary (JBC 2023–24)',
            about: 'Co-led organizational execution and committee coordination for the 2nd edition of JBC.',
            achievements: [
                'Synchronized planning across multiple student coordinator wings.',
                'Facilitated high-profile keynote setups and partner integrations.'
            ],
            quote: '"Teamwork divides the task and multiplies the success."',
            image: 'url("core_2023_arnav_mirchandani.webp")'
        },
        'tamanna_2023': {
            name: 'Tamanna Tripathi',
            designation: 'Deputy Student Secretary (JBC 2023–24)',
            about: 'Led delegate relations, internal operations, and institutional alignment.',
            achievements: [
                'Managed delegate registrations and hospitality operations.',
                'Supervised committee readiness throughout conclave execution.'
            ],
            quote: '"Consistent effort and dedication transform challenges into milestones."',
            image: 'url("core_2023_tamanna_tripathi.webp")'
        },
        'shreya_2023': {
            name: 'Shreya Kuchhal',
            designation: 'Joint Secretary • Legal & Finance (JBC 2023–24)',
            about: 'Managed accounting, legal compliance, and budgetary governance for JBC 2023–24.',
            achievements: [
                'Oversaw comprehensive financial budgeting and tracking.',
                'Drafted agreements and ensured formal compliance.'
            ],
            quote: '"Financial rigor empowers creative freedom."',
            image: 'url("core_2023_shreya_kuchhal.webp")'
        },
        'alaika_2023': {
            name: 'Alaika Cabral',
            designation: 'Joint Secretary • Public Relations (JBC 2023–24)',
            about: 'Directed public outreach, institutional communications, and campus relations.',
            achievements: [
                'Amplified JBC awareness across colleges across Mumbai and Pune.',
                'Managed delegate and dignitary communications.'
            ],
            quote: '"Communication is about building connections that endure."',
            image: 'url("core_2023_alaika_cabral.webp")'
        },
        'navya_2023': {
            name: 'Navya Thakur',
            designation: 'Joint Secretary • Brand Relations (JBC 2023–24)',
            about: 'Headed corporate sponsorship outreach and sponsor value delivery.',
            achievements: [
                'Secured partnerships with Kotak AMC, SBI Mutual Fund, and Dr. Vaidya\'s.',
                'Delivered maximum brand engagement during the event.'
            ],
            quote: '"Shared values build enduring brand partnerships."',
            image: 'url("core_2023_navya_thakur.webp")'
        },
        'vitra_2023': {
            name: 'Vitra Jain',
            designation: 'Joint Secretary • Media & Creatives (JBC 2023–24)',
            about: 'Supervised aesthetic design, branding collateral, and digital media production.',
            achievements: [
                'Developed the "Expanding Horizons" visual theme.',
                'Produced creative assets for online campaigns and stage installations.'
            ],
            quote: '"Design is intelligence made visible."',
            image: 'url("core_2023_vitra_jain.webp")'
        },
        'siddhi_2023': {
            name: 'Siddhi Ojha',
            designation: 'Joint Secretary • Executions (JBC 2023–24)',
            about: 'Coordinated event staging, technical operations, and guest protocol.',
            achievements: [
                'Ensured clockwork execution of multi-speaker panel tracks.',
                'Handled rapid on-ground problem resolution.'
            ],
            quote: '"Calm in chaos, disciplined in execution."',
            image: 'url("core_2023_siddhi_ojha.webp")'
        },
        'diya_2023': {
            name: 'Diya Agarwal',
            designation: 'Joint Secretary • Events (JBC 2023–24)',
            about: 'Curated competition frameworks, workshop schedules, and student experiences.',
            achievements: [
                'Engineered engaging inter-collegiate business case simulations.',
                'Orchestrated speaker welcomes and delegate engagement sessions.'
            ],
            quote: '"Every experience designed with intent creates inspiration."',
            image: 'url("core_2023_diya_agarwal.webp")'
        },
        'nishka_2022': {
            name: 'Nishka Khandelwal',
            designation: 'Founder & Student Secretary (JBC 2022–23)',
            about: 'Founder of the Jai Hind Business Conclave. Driven by the vision to bridge academia and real-world corporate industry, she laid the foundational bedrock of JBC during Jai Hind College\'s 75th Jubilee year, orchestrating landmark collaborations with NSE Academy, HDFC Mutual Fund, and premier corporate leaders.',
            achievements: [
                'Founded and instituted the Jai Hind Business Conclave from concept to reality.',
                'Pioneered the historic Invest Verse collaboration with the National Stock Exchange (NSE) at BKC.',
                'Inaugurated the "Just Be Candid" official BBA business podcast series.'
            ],
            quote: '"What started as an idea grew into a movement that brought together entrepreneurs, policymakers, and innovators to inspire young minds."',
            image: 'url("core_2022_nishka_khandelwal.webp")'
        },
        'taksh_2022': {
            name: 'Taksh Jain',
            designation: 'Joint Secretary • Brand Relations (JBC 2022–23)',
            about: 'Led corporate outreach and brand alliances for the inaugural edition of JBC, securing landmark partnerships and institutional presence.',
            achievements: [
                'Spearheaded corporate relations and sponsorship drives.',
                'Facilitated industry alignments for the inaugural conclave.'
            ],
            quote: '"Building authentic relationships that bridge students with industry pioneers."',
            image: 'url("core_2022_taksh_jain.webp")'
        },
        'avni_2022': {
            name: 'Avni Mandhan',
            designation: 'Joint Secretary • Public Relations (JBC 2022–23)',
            about: 'Spearheaded communications and institutional public relations, establishing the public presence of the inaugural conclave.',
            achievements: [
                'Drove campus-wide and inter-collegiate engagement.',
                'Managed media liaison and executive relations.'
            ],
            quote: '"Connecting visionary ideas with ambitious young leaders."',
            image: 'url("core_2022_avni_mandhan.webp")'
        },
        'manan_2022': {
            name: 'Manan Vaswani',
            designation: 'Joint Secretary • Marketing (JBC 2022–23)',
            about: 'Drove promotional strategy and delegate turnout for JBC 2022–23, creating wide visibility across colleges.',
            achievements: [
                'Executed launch campaigns across digital and on-ground channels.',
                'Maximized conclave attendance across all sessions.'
            ],
            quote: '"Transforming engagement into lasting impact."',
            image: 'url("core_2022_manan_vaswani.webp")'
        },
        'yadith_2022': {
            name: 'Yadith Nichani',
            designation: 'Joint Secretary • Events (JBC 2022–23)',
            about: 'Orchestrated event itineraries, stage coordination, and guest experiences for the inaugural conclave.',
            achievements: [
                'Managed stage operations and seamless execution across all segments.',
                'Coordinated the flagship Invest Verse simulation event at NSE.'
            ],
            quote: '"Precision planning creates memorable experiences."',
            image: 'url("core_2022_yadith_nichani.webp")'
        },
        'nishad_2022': {
            name: 'Nishad Dhote',
            designation: 'Joint Secretary • Legal & Finance (JBC 2022–23)',
            about: 'Oversaw budgetary allocation, financial auditing, and contractual compliance for the foundational year.',
            achievements: [
                'Maintained financial governance and fiscal transparency.',
                'Secured formal agreements with partners and venues.'
            ],
            quote: '"Robust foundations enable boundless ambition."',
            image: 'url("core_2022_nishad_dhote.webp")'
        },
        'sneha_2022': {
            name: 'Sneha Sharma',
            designation: 'Joint Secretary • Executions & Tech (JBC 2022–23)',
            about: 'Headed event execution and technological integration, ensuring smooth delegate registration and audiovisual workflows.',
            achievements: [
                'Built digital registration workflows and technical infrastructure.',
                'Managed on-ground IT and media setup.'
            ],
            quote: '"Behind every flawless event is relentless attention to detail."',
            image: 'url("core_2022_sneha_sharma.webp")'
        },
        'shemon_2022': {
            name: 'Shemon Chawla',
            designation: 'Joint Secretary • Creatives (JBC 2022–23)',
            about: 'Crafted the visual identity, event branding, and stage aesthetics of the inaugural Jai Hind Business Conclave.',
            achievements: [
                'Designed official conclave identity and promotional collateral.',
                'Curated aesthetic stage and venue ambiance.'
            ],
            quote: '"Design gives voice and form to big ideas."',
            image: 'url("core_2022_shemon_chawla.webp")'
        },
        'hriti_2022': {
            name: 'Hriti Shah',
            designation: 'Joint Secretary • Media (JBC 2022–23)',
            about: 'Led press coverage, media releases, and digital storytelling for JBC’s historic inaugural edition.',
            achievements: [
                'Secured national press features across major business news publications.',
                'Spearheaded official documentation and post-event media production.'
            ],
            quote: '"Stories told well inspire generations."',
            image: 'url("core_2022_hriti_shah.webp")'
        }
    };

    let currentOpenTeamId = null;

    function populateTeamModal(teamId) {
        if (!teamId || !teamData[teamId]) return;
        currentOpenTeamId = teamId;
        const data = teamData[teamId];
        
        document.querySelector('.team-profile-name').innerText = data.name;
        document.querySelector('.team-profile-designation').innerText = data.designation;
        
        const aboutEl = document.querySelector('.team-profile-about');
        aboutEl.style.whiteSpace = 'pre-line';
        aboutEl.innerText = data.about;
        
        const achievementsContainer = document.querySelector('.team-achievements-block');
        const achievementsList = document.querySelector('.team-profile-achievements');
        achievementsList.innerHTML = '';
        
        if (data.achievements && data.achievements.length > 0) {
            if (achievementsContainer) achievementsContainer.style.display = 'block';
            data.achievements.forEach(ach => {
                const li = document.createElement('li');
                li.style.marginBottom = '0.5rem';
                li.innerText = ach;
                achievementsList.appendChild(li);
            });
        } else if (achievementsContainer) {
            achievementsContainer.style.display = 'none';
        }
        
        document.querySelector('.team-profile-quote').innerText = data.quote;
        const thumbEl = document.querySelector(`.team-card[data-team="${teamId}"] .team-image, .mentor-card[data-team="${teamId}"] .mentor-image-wrap`);
        document.querySelector('.team-profile-image').style.backgroundImage = layeredBackground(data.image, thumbEl);

        const teamSocialRow = document.getElementById('team-social-row');
        const teamLinkedInLink = document.getElementById('team-linkedin-link');
        if (data.linkedin && teamLinkedInLink) {
            teamLinkedInLink.href = data.linkedin;
            if (teamSocialRow) teamSocialRow.style.display = 'flex';
        } else if (teamSocialRow) {
            teamSocialRow.style.display = 'none';
        }
    }

    // Dynamic click delegation for team and mentor cards
    document.addEventListener('click', (e) => {
        // If clicking on an anchor, external button, or social link inside the card, do not open modal
        if (e.target.closest('a, .speaker-linkedin-btn, .speaker-instagram-btn')) return;
        
        const card = e.target.closest('.team-card, .mentor-card');
        if (!card) return;
        const teamId = card.getAttribute('data-team');
        if (teamId && teamData[teamId]) {
            populateTeamModal(teamId);
            openOverlay(teamOverlay);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            if (e.target.closest('a, .speaker-linkedin-btn, .speaker-instagram-btn')) return;
            const card = e.target.closest('.team-card, .mentor-card');
            if (card) {
                const teamId = card.getAttribute('data-team');
                if (teamId && teamData[teamId]) {
                    e.preventDefault();
                    populateTeamModal(teamId);
                    openOverlay(teamOverlay);
                }
            }
        }
    });

    /* --- Core Team Multi-Year Edition Switcher --- */
    const teamTabButtons = document.querySelectorAll('.team-tab-btn');
    const teamPanels = document.querySelectorAll('.team-edition-panel');

    if (teamTabButtons.length > 0 && teamPanels.length > 0) {
        teamTabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetEdition = btn.getAttribute('data-edition');
                if (!targetEdition) return;

                // Update active tab button
                teamTabButtons.forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-selected', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-selected', 'true');
                try {
                    btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                } catch (e) {}

                // Switch panels with smooth fade
                teamPanels.forEach(panel => {
                    if (panel.id === `edition-${targetEdition}`) {
                        panel.classList.add('active');
                        // Immediately resolve deferred images in this newly visible panel
                        loadDeferredBackgroundsIn(panel);
                        if (hasGSAP && !prefersReducedMotion) {
                            gsap.fromTo(panel,
                                { opacity: 0, y: 15 },
                                { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }
                            );
                        } else {
                            panel.style.opacity = '1';
                        }
                    } else {
                        panel.classList.remove('active');
                    }
                });

                // Refresh ScrollTrigger so positions stay accurate (panel heights differ per edition)
                ScrollTrigger.refresh();
            });
        });
    }

    const teamCloseBtns = document.querySelectorAll('.close-team-profile');
    teamCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => closeOverlay(teamOverlay));
    });

    /* --- Mentors Grid Reveal --- */
    const mentorCards = document.querySelectorAll('.mentors-grid .mentor-card');
    if (mentorCards.length > 0) {
        gsap.fromTo(mentorCards, 
            { opacity: 0, y: 40 },
            {
                opacity: 1,
                y: 0,
                duration: 0.8,
                stagger: 0.15,
                ease: "power2.out",
                scrollTrigger: {
                    trigger: ".mentors-grid",
                    start: "top 85%"
                }
            }
        );
    }

    /* --- Core Team Grid Reveal (one trigger per edition grid, so cards in tabs opened later still reveal) --- */
    document.querySelectorAll('.editorial-grid').forEach(grid => {
        const gridCards = grid.querySelectorAll('.team-card');
        if (gridCards.length === 0) return;
        gsap.fromTo(gridCards,
            { opacity: 0, y: 50 },
            {
                opacity: 1,
                y: 0,
                duration: 0.8,
                stagger: 0.1,
                ease: "power2.out",
                scrollTrigger: {
                    trigger: grid,
                    start: "top 80%",
                    once: true
                }
            }
        );
    });

    /* --- SEO FAQ Accordion Functionality --- */
    const faqItems = document.querySelectorAll('.faq-item');
    let faqRefreshTimer = null;
    faqItems.forEach(item => {
        const questionBtn = item.querySelector('.faq-question');
        if (questionBtn) {
            questionBtn.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                // Close other items
                faqItems.forEach(otherItem => {
                    if (otherItem !== item) {
                        otherItem.classList.remove('active');
                        const otherBtn = otherItem.querySelector('.faq-question');
                        if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
                    }
                });
                // Toggle current item
                if (isActive) {
                    item.classList.remove('active');
                    questionBtn.setAttribute('aria-expanded', 'false');
                } else {
                    item.classList.add('active');
                    questionBtn.setAttribute('aria-expanded', 'true');
                }
                
                // Recalculate ScrollTrigger measurements once the expand/collapse transition settles
                clearTimeout(faqRefreshTimer);
                faqRefreshTimer = setTimeout(() => ScrollTrigger.refresh(), 450);
            });
        }
    });
    /* --- Active Nav Link Highlighting via ScrollTrigger --- */
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');

    sections.forEach(section => {
        ScrollTrigger.create({
            trigger: section,
            start: 'top 40%',
            end: 'bottom 40%',
            onToggle: self => {
                if (self.isActive) {
                    const sectionId = section.getAttribute('id');
                    navLinks.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === `#${sectionId}`) {
                            link.classList.add('active');
                        }
                    });
                }
            }
        });
    });

    // Clear active state when scrolled to top (hero)
    ScrollTrigger.create({
        trigger: '.hero',
        start: 'top top',
        end: 'bottom 40%',
        onEnter: () => navLinks.forEach(l => l.classList.remove('active')),
        onEnterBack: () => navLinks.forEach(l => l.classList.remove('active'))
    });

    /* --- Mobile Menu Hamburger Toggle with Backdrop & Scroll Lock --- */
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinksContainer = document.querySelector('.nav-links');
    const navBackdrop = document.getElementById('nav-backdrop');

    function openMobileMenu() {
        if (!menuToggle || !navLinksContainer) return;
        menuToggle.classList.add('active');
        navLinksContainer.classList.add('active');
        if (navBackdrop) navBackdrop.classList.add('active');
        document.body.classList.add('nav-open');
        menuToggle.setAttribute('aria-expanded', 'true');
        lockScroll('menu');
    }

    function closeMobileMenu() {
        if (!menuToggle || !navLinksContainer || !menuToggle.classList.contains('active')) return;
        menuToggle.classList.remove('active');
        navLinksContainer.classList.remove('active');
        if (navBackdrop) navBackdrop.classList.remove('active');
        document.body.classList.remove('nav-open');
        menuToggle.setAttribute('aria-expanded', 'false');
        unlockScroll('menu');
    }

    if (menuToggle && navLinksContainer) {
        function toggleMobileMenu() {
            const isOpen = menuToggle.classList.contains('active');
            if (isOpen) {
                closeMobileMenu();
            } else {
                openMobileMenu();
            }
        }

        menuToggle.addEventListener('click', toggleMobileMenu);

        // Keyboard: Enter and Space activate the hamburger
        menuToggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleMobileMenu();
            }
        });

        // Close on backdrop tap
        if (navBackdrop) {
            navBackdrop.addEventListener('click', closeMobileMenu);
        }

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeMobileMenu();
        });

        // Close mobile menu when ANY link in the drawer is clicked (including .btn-register.mobile-only)
        navLinksContainer.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', closeMobileMenu);
        });

        // Rotating a tablet / resizing to desktop width must never leave the page scroll-locked
        if (window.matchMedia) {
            const desktopNavQuery = window.matchMedia('(min-width: 1025px)');
            const onDesktopNav = (e) => { if (e.matches) closeMobileMenu(); };
            if (desktopNavQuery.addEventListener) desktopNavQuery.addEventListener('change', onDesktopNav);
            else if (desktopNavQuery.addListener) desktopNavQuery.addListener(onDesktopNav);
        }
    }

    /* --- In-page anchor navigation (works with Lenis on desktop and native scrolling on mobile) --- */
    function getNavOffset() {
        const nav = cachedNavbar || document.querySelector('.navbar');
        const navHeight = nav ? nav.getBoundingClientRect().height : 0;
        return Math.round((navHeight || 72) + 8);
    }

    function scrollToElement(targetElement) {
        const offset = getNavOffset();
        if (lenis) {
            lenis.scrollTo(targetElement, { offset: -offset, duration: 1.5 });
            return;
        }
        const top = targetElement.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0) - offset;
        window.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }

    // Smooth scroll for internal nav anchor links (excluding target="_blank" modal action links)
    document.querySelectorAll('a[href^="#"]:not([target="_blank"])').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (!targetId || targetId === '#' || targetId.startsWith('http') || targetId.startsWith('//')) return;

            let targetElement = null;
            try {
                targetElement = document.querySelector(targetId);
            } catch (err) {
                return; // Invalid selector: let the browser handle it
            }
            if (!targetElement) return;

            e.preventDefault();
            // Release the menu's scroll lock first so the page can actually move
            closeMobileMenu();
            scrollToElement(targetElement);
        });
    });

    /* --- Lazy Loading Background Images (single source of truth for every [data-lazy-bg]) --- */
    if (!supportsLazyBg || !hasGSAP) {
        // No observer support (or degraded no-GSAP mode): show every photo right away so nothing stays grey
        loadDeferredBackgroundsIn(document);
    } else {
        const lazyObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    loadDeferredBackground(entry.target);
                    lazyObserver.unobserve(entry.target);
                }
            });
        }, {
            rootMargin: '600px 0px',
            threshold: 0
        });

        // Group gates: resolve a whole container once it nears the viewport.
        // - Speaker carousel: cards are clipped by the horizontal track, so per-card observation would
        //   flash grey placeholders while swiping.
        // - Legacy museum: chapters sit in a pinned 3D stage (opacity 0 / pushed back in Z) until scrubbed in.
        const groupRoots = [accordionTrack, document.getElementById('legacy')].filter(Boolean);
        const groupedEls = new Set();
        groupRoots.forEach(root => root.querySelectorAll('[data-lazy-bg]').forEach(el => groupedEls.add(el)));

        if (groupRoots.length > 0) {
            const groupGate = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        loadDeferredBackgroundsIn(entry.target);
                        groupGate.unobserve(entry.target);
                    }
                });
            }, { rootMargin: '600px 0px' });
            groupRoots.forEach(root => groupGate.observe(root));
        }

        document.querySelectorAll('[data-lazy-bg]').forEach(el => {
            if (!groupedEls.has(el)) lazyObserver.observe(el);
        });
    }

    /* --- Keyboard Accessibility: Make interactive non-button elements focusable --- */
    // Accordion speaker items
    document.querySelectorAll('.accordion-item').forEach(item => {
        item.setAttribute('tabindex', '0');
        item.setAttribute('role', 'button');
        const speakerName = item.querySelector('.expanded-left h3') || item.querySelector('.speaker-surname');
        if (speakerName) {
            item.setAttribute('aria-label', `View ${speakerName.textContent} speaker profile`);
        }
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                item.click();
            }
        });
    });

    // Team cards
    document.querySelectorAll('.team-card').forEach(card => {
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        const name = card.querySelector('.team-name');
        if (name) {
            card.setAttribute('aria-label', `View ${name.textContent} profile`);
        }
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                card.click();
            }
        });
    });

    // Experience cards
    document.querySelectorAll('.exp-card').forEach(card => {
        card.setAttribute('tabindex', '0');
        const title = card.querySelector('h3');
        if (title) card.setAttribute('aria-label', title.textContent);
    });

    // Clip cards
    document.querySelectorAll('.clip-card').forEach(card => {
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        const name = card.querySelector('.clip-speaker-name');
        if (name) {
            card.setAttribute('aria-label', `Play clip: ${name.textContent}`);
        }
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                card.click();
            }
        });
    });

    // Session filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.setAttribute('role', 'tab');
    });

    // Slot navigation buttons
    const slotPrev = document.getElementById('slot-prev');
    const slotNext = document.getElementById('slot-next');
    if (slotPrev) slotPrev.setAttribute('tabindex', '0');
    if (slotNext) slotNext.setAttribute('tabindex', '0');

    // Robust Mailto & Contact UX Handler
    let contactToast = document.querySelector('.contact-toast');
    if (!contactToast) {
        contactToast = document.createElement('div');
        contactToast.className = 'contact-toast';
        contactToast.setAttribute('role', 'alert');
        document.body.appendChild(contactToast);
    }

    let toastTimer = null;
    function triggerContactToast(email) {
        if (!contactToast) return;
        contactToast.innerHTML = `
            <span>&#10003; Email copied: <strong>${email}</strong></span>
            <a href="https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=Inquiry%20-%20Jai%20Hind%20Business%20Conclave" target="_blank" rel="noopener noreferrer" class="contact-toast-gmail-btn">Open in Gmail &rarr;</a>
        `;
        contactToast.classList.add('active');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            contactToast.classList.remove('active');
        }, 5500);
    }

    document.querySelectorAll('a[href^="mailto:"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const rawHref = link.getAttribute('href') || '';
            const email = rawHref.replace('mailto:', '').split('?')[0] || 'jaihindbussinessconvcalve27@gmail.com';
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(email).catch(() => {});
            }
            triggerContactToast(email);
        });
    });

    // ScrollTrigger already refreshes itself on window "load"; only re-measure again if web fonts
    // finish after that (late font swaps change text heights and would shift pinned-section positions)
    window.addEventListener('load', () => {
        measureMaxScroll();
        if (document.fonts && document.fonts.status !== 'loaded') {
            document.fonts.ready.then(() => ScrollTrigger.refresh());
        }
    });
});
