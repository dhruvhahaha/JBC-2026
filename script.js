// Initialize Lenis for Smooth Scrolling
const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    direction: 'vertical',
    gestureDirection: 'vertical',
    smooth: true,
    mouseMultiplier: 1,
    smoothTouch: false,
    touchMultiplier: 2,
    infinite: false,
});

// Register GSAP Plugins
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

// Ensure ScrollTrigger updates with Lenis and update scroll progress bar
lenis.on('scroll', (e) => {
    if (document.body.classList.contains('modal-open')) return;
    ScrollTrigger.update();
    const scrollPx = window.scrollY || document.documentElement.scrollTop;
    const winHeightPx = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = winHeightPx > 0 ? (scrollPx / winHeightPx) * 100 : 0;
    const progressBar = document.querySelector('.scroll-progress-bar');
    if (progressBar) {
        progressBar.style.width = `${scrolled}%`;
    }
});

gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
});

gsap.ticker.lagSmoothing(0);

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {

    /* --- Navbar Scroll Effect --- */
    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Smooth scroll for nav links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                lenis.scrollTo(targetElement, {
                    offset: -80,
                    duration: 1.5
                });
            }
        });
    });

    /* --- Hero Section Animation --- */
    const heroTl = gsap.timeline();

    // Opening cinematic title
    heroTl.to('.pre-title', {
        opacity: 1,
        duration: 2,
        ease: "power2.inOut"
    })
    .to('.pre-title', {
        opacity: 0,
        duration: 1.5,
        ease: "power2.inOut",
        delay: 1.5
    })
    .set('.opening-titles', { display: 'none' })
    .set('.main-titles', { display: 'block', opacity: 1 })
    // Reveal main title lines
    .from('.title-line', {
        y: 40,
        opacity: 0,
        duration: 1.2,
        stagger: 0.2,
        ease: "power4.out"
    })
    .to('.jbc-hero-line', {
        width: '120px',
        duration: 1.5,
        ease: "power3.inOut"
    }, "-=0.6")
    .from('.hero-subtitle', {
        y: 30,
        opacity: 0,
        duration: 1,
        ease: "power3.out"
    }, "-=0.5")
    .from('.hero-cta .btn', {
        y: 20,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: "power3.out"
    }, "-=0.5")
    .from('.hero-stats-bar', {
        y: 20,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        onStart: () => {
            // Animate the stat counters
            document.querySelectorAll('.hero-stat-number').forEach(counter => {
                const target = parseInt(counter.getAttribute('data-target'));
                const suffix = counter.getAttribute('data-suffix') || '';
                const duration = target > 100 ? 2000 : 1200;
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
    }, "-=0.3");

    // Parallax on hero video
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

    /* --- Ambient Particle Canvas with Mouse Proximity Reactivity --- */
    const particleCanvas = document.getElementById('stats-particle-canvas');
    if (particleCanvas) {
        const ctx = particleCanvas.getContext('2d');
        let width = 0, height = 0;
        let particles = [];
        let animId = null;
        let isVisible = false;
        let mouseX = -1000, mouseY = -1000;

        function resizeParticleCanvas() {
            const parent = particleCanvas.parentElement;
            if (parent) {
                width = particleCanvas.width = parent.clientWidth;
                height = particleCanvas.height = parent.clientHeight;
            }
        }

        class SubtleParticle {
            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.baseVx = (Math.random() - 0.5) * 0.35;
                this.baseVy = (Math.random() - 0.5) * 0.35;
                this.vx = this.baseVx;
                this.vy = this.baseVy;
                this.radius = Math.random() * 1.2 + 1;
                this.alpha = 0.35; // ~35% base opacity
            }

            update() {
                // Subtle cursor proximity attraction & glow
                const dx = mouseX - this.x;
                const dy = mouseY - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 120) {
                    const factor = (1 - dist / 120);
                    this.vx = this.baseVx + (dx / dist) * factor * 0.3;
                    this.vy = this.baseVy + (dy / dist) * factor * 0.3;
                    this.alpha = 0.35 + factor * 0.45; // Brighten up to ~80% near cursor
                } else {
                    this.vx += (this.baseVx - this.vx) * 0.05;
                    this.vy += (this.baseVy - this.vy) * 0.05;
                    this.alpha += (0.35 - this.alpha) * 0.05;
                }

                this.x += this.vx;
                this.y += this.vy;

                if (this.x < 0) this.x = width;
                if (this.x > width) this.x = 0;
                if (this.y < 0) this.y = height;
                if (this.y > height) this.y = 0;
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(204, 0, 0, ${this.alpha * 0.7})`;
                ctx.fill();
            }
        }

        function initParticles() {
            resizeParticleCanvas();
            particles = [];
            const particleCount = Math.min(Math.floor((width * height) / 11000), 45);
            for (let i = 0; i < particleCount; i++) {
                particles.push(new SubtleParticle());
            }
        }

        function drawParticles() {
            if (!isVisible) return;
            ctx.clearRect(0, 0, width, height);

            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                particles[i].draw();

                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    // Connecting lines at ~9% opacity when close
                    if (dist < 110) {
                        const lineAlpha = (1 - dist / 110) * 0.09;
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(204, 0, 0, ${lineAlpha * 1.2})`;
                        ctx.lineWidth = 0.8;
                        ctx.stroke();
                    }
                }
            }
            animId = requestAnimationFrame(drawParticles);
        }

        const statsSectionEl = particleCanvas.closest('.stats-section');
        if (statsSectionEl) {
            statsSectionEl.addEventListener('mousemove', (e) => {
                const rect = particleCanvas.getBoundingClientRect();
                mouseX = e.clientX - rect.left;
                mouseY = e.clientY - rect.top;
            });

            statsSectionEl.addEventListener('mouseleave', () => {
                mouseX = -1000;
                mouseY = -1000;
            });
        }

        window.addEventListener('resize', () => {
            resizeParticleCanvas();
            initParticles();
        });

        initParticles();

        ScrollTrigger.create({
            trigger: ".stats-section",
            start: "top bottom",
            end: "bottom top",
            onEnter: () => { isVisible = true; drawParticles(); },
            onLeave: () => { isVisible = false; if (animId) cancelAnimationFrame(animId); },
            onEnterBack: () => { isVisible = true; drawParticles(); },
            onLeaveBack: () => { isVisible = false; if (animId) cancelAnimationFrame(animId); }
        });
    }

    /* --- Scroll-Triggered Staggered Entrance & 1.5s Count-Up Animation --- */
    const flatStatItems = document.querySelectorAll('.stats-flat-row .stat-flat-item');
    if (flatStatItems.length > 0) {
        ScrollTrigger.create({
            trigger: ".stats-section",
            start: "top 80%",
            once: true,
            onEnter: () => {
                // 8. Staggered fade-in + slight upward translate (~100ms apart)
                gsap.to(flatStatItems, {
                    opacity: 1,
                    y: 0,
                    duration: 0.8,
                    stagger: 0.1, // 100ms stagger
                    ease: "power2.out"
                });

                // 7. Count-up animation on scroll (~1.5s duration, power3.out ease)
                flatStatItems.forEach(item => {
                    const numEl = item.querySelector('.stat-number-flat');
                    if (numEl) {
                        const target = parseInt(numEl.getAttribute('data-target'));
                        gsap.to(numEl, {
                            innerHTML: target,
                            duration: 1.5,
                            ease: "power3.out",
                            snap: { innerHTML: 1 },
                            onUpdate: function() {
                                numEl.innerHTML = Math.round(numEl.innerHTML);
                            }
                        });
                    }
                });
            }
        });
    }

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

    if (museumSection && museumViewport && museumChapters.length > 0) {
        
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

            function initMuseumParticles() {
                resizeMuseumCanvas();
                dustParticles = [];
                for (let i = 0; i < 180; i++) {
                    dustParticles.push(new DustParticle());
                }
            }

            function renderMuseumParticles() {
                if (!isMuseumVisible) return;
                ctx.clearRect(0, 0, mw, mh);

                for (let i = 0; i < dustParticles.length; i++) {
                    dustParticles[i].update();
                    dustParticles[i].draw();
                }
                animFrameId = requestAnimationFrame(renderMuseumParticles);
            }

            window.addEventListener('resize', () => {
                resizeMuseumCanvas();
                initMuseumParticles();
            });

            initMuseumParticles();

            ScrollTrigger.create({
                trigger: museumSection,
                start: "top bottom",
                end: "bottom top",
                onUpdate: (self) => {
                    scrollProgress = self.progress;
                    // Living Crimson Thread Grows More Intense Towards 2026
                    if (crimsonThread) {
                        const threadOpacity = 0.15 + (self.progress * 0.8);
                        const glowRadius = 15 + (self.progress * 40);
                        crimsonThread.style.opacity = threadOpacity;
                        crimsonThread.style.boxShadow = `0 0 ${glowRadius}px rgba(204, 0, 0, ${0.4 + self.progress * 0.5})`;
                    }
                },
                onEnter: () => { isMuseumVisible = true; renderMuseumParticles(); },
                onLeave: () => { isMuseumVisible = false; if (animFrameId) cancelAnimationFrame(animFrameId); },
                onEnterBack: () => { isMuseumVisible = true; renderMuseumParticles(); },
                onLeaveBack: () => { isMuseumVisible = false; if (animFrameId) cancelAnimationFrame(animFrameId); }
            });
        }

        /* 2. GSAP ScrollTrigger Evolving Architectural Camera Trajectory & Finale Monolith Portal */
        const museumTL = gsap.timeline({
            scrollTrigger: {
                trigger: museumSection,
                start: "top top",
                end: "bottom bottom",
                pin: ".museum-sticky-viewport",
                scrub: 0.8
            }
        });

        museumChapters.forEach((chapter, idx) => {
            const yearAttr = chapter.getAttribute('data-year');
            const isFinale = yearAttr === 'finale';

            if (!isFinale) {
                // Phase 1: Enter from perspective depth (-2000px -> 0px)
                museumTL.fromTo(chapter,
                    { transform: 'translate3d(-50%, -50%, -2000px) scale(0.75)', opacity: 0, filter: 'blur(10px)' },
                    {
                        transform: 'translate3d(-50%, -50%, 0px) scale(1)',
                        opacity: 1,
                        filter: 'blur(0px)',
                        duration: 1.4,
                        ease: "power2.out"
                    }
                );

                // Milestone specific 3D architectural transformations
                if (yearAttr === '2023') {
                    const pLeft = chapter.querySelector('.panel-left');
                    const pRight = chapter.querySelector('.panel-right');
                    if (pLeft && pRight) {
                        museumTL.fromTo([pLeft, pRight],
                            { opacity: 0, scale: 0.85 },
                            { opacity: 1, scale: 1, duration: 0.8, ease: "power2.out" },
                            "-=0.6"
                        );
                    }
                } else if (yearAttr === '2024') {
                    const photoCubes = chapter.querySelectorAll('.orbiting-photo-cube');
                    if (photoCubes.length > 0) {
                        museumTL.fromTo(photoCubes,
                            { opacity: 0, scale: 0.7 },
                            { opacity: 1, scale: 1, stagger: 0.1, duration: 1.0, ease: "power2.out" },
                            "-=0.8"
                        );
                    }
                } else if (yearAttr === '2025') {
                    const tajCard = chapter.querySelector('.taj-media-card');
                    if (tajCard) {
                        museumTL.fromTo(tajCard,
                            { opacity: 0, y: 30 },
                            { opacity: 1, y: 0, duration: 1.0, ease: "power2.out" },
                            "-=0.8"
                        );
                    }
                }

                // Phase 2: Hold & comfortably view milestone in focus
                museumTL.to(chapter, { transform: 'translate3d(-50%, -50%, 40px) scale(1)', duration: 1.1, ease: "none" })

                // Phase 3: Controlled smooth exit without screen collision
                .to(chapter,
                    {
                        transform: 'translate3d(-50%, -52%, 260px) scale(1.06)',
                        opacity: 0,
                        filter: 'blur(8px)',
                        duration: 1.1,
                        ease: "power2.in"
                    },
                    "-=0.1"
                );

            } else {
                // Finale Monolith Node: 180° Monolith Flip & Light Beam Portal Activation
                museumTL.fromTo(chapter,
                    { transform: 'translate3d(-50%, -50%, -2000px) scale(0.75)', opacity: 0, filter: 'blur(10px)' },
                    {
                        transform: 'translate3d(-50%, -50%, 0px) scale(1)',
                        opacity: 1,
                        filter: 'blur(0px)',
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
                        width: '100%',
                        opacity: 1,
                        duration: 0.8,
                        ease: "power2.out",
                        onStart: () => {
                            portalBeam.classList.add('open');
                        }
                    });
                }

                // Fly smoothly into next section
                museumTL.to(chapter, {
                    transform: 'translate3d(-50%, -52%, 350px) scale(1.1)',
                    opacity: 0,
                    filter: 'blur(10px)',
                    duration: 1.2,
                    ease: "power2.in"
                });
            }
        });

        /* 3D Mouse Parallax Architecture Tilt */
        museumViewport.addEventListener('mousemove', (e) => {
            const rect = museumViewport.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
            const mouseY = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);

            const rotX = -mouseY * 4;
            const rotY = mouseX * 4;

            if (museumStage) {
                gsap.to(museumStage, {
                    rotateX: rotX,
                    rotateY: rotY,
                    duration: 0.6,
                    ease: "power2.out"
                });
            }
        });

        museumViewport.addEventListener('mouseleave', () => {
            if (museumStage) {
                gsap.to(museumStage, {
                    rotateX: 0,
                    rotateY: 0,
                    duration: 0.9,
                    ease: "power2.out"
                });
            }
        });
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
            image: 'url("speaker_sahil_makhija.webp")'
        },
        'keki_mistry': {
            name: 'Mr. Keki Mistry',
            role: 'SPEAKER',
            session: '2025-26 • Banking on the Future',
            designation: 'Interim Chairman',
            company: 'HDFC Bank',
            bio: "Keki Mistry, one of the most respected voices in India\u2019s financial ecosystem, has played a defining role in shaping the country\u2019s banking and corporate landscape through decades of visionary leadership and strategic foresight.",
            quote: "Banking on the Future",
            image: 'url("speaker_keki_mistry.webp")'
        },
        'arjit_garg': {
            name: 'Mr. Arjit Garg',
            role: 'MODERATOR',
            session: '2025-26 • Navigating Risk in Your 20’s',
            designation: 'India’s Youngest SEBI Registered Research Analyst',
            company: 'Financial Markets',
            bio: "Known for his work in equity research, investor education, and financial markets, Arjit has developed a strong perspective on how young individuals can approach investing, decision-making, and risk management.",
            quote: "Navigating Risk in Your 20\u2019s",
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
            image: 'url("speaker_annkur_khosla.webp")'
        },
        'simran_advani': {
            name: 'Ms. Simran Advani',
            role: 'PANELIST',
            session: '2025-26 • A Seat at the Table',
            designation: 'Founder of Nova & Co-Founder of Pastel',
            company: 'Nova & Pastel Patisserie',
            bio: "Inspired by Italy\u2019s rich dessert culture and driven by a passion for craftsmanship, Simran transformed an unconventional journey into one of Mumbai\u2019s most distinctive dessert ventures.",
            quote: "A Seat at the Table",
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
            image: 'url("speaker_enrico_signorelli.webp")'
        },
        'abhijeet_anand': {
            name: 'Mr. Abhijeet Anand',
            role: 'PANELIST',
            session: '2025-26 • A Seat at the Table',
            designation: 'Founder & Chief Executive Officer',
            company: 'abcoffee',
            bio: "With a disruptive and technology-driven approach to coffee retail, Abhijeet has built one of the country\u2019s fastest growing caf\u00e9 concepts by combining quality, convenience, and affordability.",
            quote: "A Seat at the Table",
            image: 'url("speaker_abhijeet_anand.webp")'
        },
        'vik_khatwani': {
            name: 'Mr. Vik Khatwani',
            role: 'PANELIST',
            session: '2025-26 • A Seat at the Table',
            designation: 'Founder',
            company: 'Earth Café',
            bio: "Leaving behind a successful career in jewelry manufacturing, Vik transformed a personal philosophy into one of Mumbai\u2019s most recognized plant based and gluten free caf\u00e9 brands.",
            quote: "A Seat at the Table",
            image: 'url("speaker_vik_khatwani.webp")'
        },
        'shlok_savjani': {
            name: 'Mr. Shlok Savjani',
            role: 'PANELIST',
            session: '2025-26 • A Seat at the Table',
            designation: 'Managing Partner',
            company: 'Maroosh',
            bio: "Representing one of Mumbai\u2019s most loved culinary brands, Shlok has played a key role in evolving Maroosh while staying true to the authenticity and flavors that built its loyal community.",
            quote: "A Seat at the Table",
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
            image: 'url("speaker_yash_advani.webp")'
        },
        'sankalp_kelshikar': {
            name: 'Mr. Sankalp Kelshikar',
            role: 'SPEAKER',
            session: '2025-26 • Moving India Forward',
            designation: 'Co-Founder',
            company: 'Cityflo Buses',
            bio: "With a vision to transform the everyday commute experience, Mr. Kelshikar has redefined urban mobility by building one of India\u2019s most innovative consumer-focused transportation platforms.",
            quote: "Moving India Forward",
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
            image: 'url("speaker_rajat_bhatia.webp")'
        },
        'maulik_bhansali': {
            name: 'Mr. Maulik Bhansali',
            role: 'SPEAKER',
            session: '2025-26 • Navigating Risk in Your 20’s',
            designation: 'Chief Risk Officer',
            company: 'Union Asset Management Co. Pvt. Ltd.',
            bio: "A master of foresight in India\u2019s investment sector. Backed by a passion for financial stability and risk-reward optimization, Mr. Bhansali has played a pivotal role in institutional resilience.",
            quote: "Navigating Risk in Your 20\u2019s",
            image: 'url("speaker_maulik_bhansali.webp")'
        }
    };

    /* --- Modal Background Touchpad Scroll Preventer --- */
    window.addEventListener('wheel', (e) => {
        if (document.body.classList.contains('modal-open')) {
            const scrollable = e.target.closest('.profile-right');
            if (!scrollable) {
                e.preventDefault();
            }
        }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
        if (document.body.classList.contains('modal-open')) {
            const scrollable = e.target.closest('.profile-right');
            if (!scrollable) {
                e.preventDefault();
            }
        }
    }, { passive: false });

    // View Session Button click handler
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.view-session-btn');
        if (btn) {
            e.stopPropagation();
            const speakerId = btn.getAttribute('data-speaker');
            const data = speakerData[speakerId];
            
            if (data && speakerOverlay) {
                // Populate data
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
                if (imgContainer) imgContainer.style.backgroundImage = data.image;
                
                // Open overlay with scroll lock
                document.body.classList.add('modal-open');
                lenis.stop();

                const speakerRight = speakerOverlay.querySelector('.profile-right');
                if (speakerRight) speakerRight.scrollTop = 0;
                speakerOverlay.classList.add('open');
                
                // Animate content in
                gsap.fromTo('#speaker-overlay .profile-right > *', 
                    { opacity: 0, y: 30 }, 
                    { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, delay: 0.2, ease: "power3.out" }
                );
            }
        }
    });

    // Close speaker profile overlay
    const speakerCloseBtns = document.querySelectorAll('.close-speaker-profile, .close-profile');
    speakerCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (speakerOverlay) speakerOverlay.classList.remove('open');
            document.body.classList.remove('modal-open');
            if (typeof lenis !== 'undefined' && lenis) lenis.start();
        });
    });

    // Escape key to close speaker overlay
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && speakerOverlay && speakerOverlay.classList.contains('open')) {
            speakerOverlay.classList.remove('open');
            document.body.classList.remove('modal-open');
            if (typeof lenis !== 'undefined' && lenis) lenis.start();
        }
    });

    /* --- Speaker Clips 3D Center-Stage Carousel --- */
    const clipModal = document.getElementById('clip-video-modal');
    const clipVideo = document.getElementById('clip-modal-video');
    const clipModalClose = document.getElementById('clip-modal-close');
    const clipsStage = document.getElementById('clips-carousel-stage');
    const clipCards = Array.from(document.querySelectorAll('.clip-card'));
    const clipsPrevBtn = document.getElementById('clips-prev');
    const clipsNextBtn = document.getElementById('clips-next');
    const dockPrevBtn = document.getElementById('dock-prev-btn');
    const dockNextBtn = document.getElementById('dock-next-btn');
    const clipsPagination = document.getElementById('clips-pagination');

    if (clipsStage && clipCards.length > 0) {
        let currentClipIndex = 0;
        const totalClips = clipCards.length;
        let autoplayTimer = null;

        // Create pagination dots
        if (clipsPagination) {
            clipsPagination.innerHTML = '';
            clipCards.forEach((_, idx) => {
                const dot = document.createElement('button');
                dot.className = `clips-dot ${idx === 0 ? 'active' : ''}`;
                dot.setAttribute('aria-label', `Go to clip ${idx + 1}`);
                dot.addEventListener('click', (e) => {
                    e.stopPropagation();
                    updateCarousel(idx);
                });
                clipsPagination.appendChild(dot);
            });
        }

        function updateCarousel(newIndex) {
            currentClipIndex = (newIndex + totalClips) % totalClips;

            clipCards.forEach((card, idx) => {
                // Calculate shortest distance in circular array
                let diff = idx - currentClipIndex;
                if (diff > totalClips / 2) diff -= totalClips;
                if (diff < -totalClips / 2) diff += totalClips;

                // Reset positioning classes
                card.classList.remove('active', 'prev', 'next', 'far-prev', 'far-next');

                if (diff === 0) {
                    card.classList.add('active');
                } else if (diff === -1) {
                    card.classList.add('prev');
                } else if (diff === 1) {
                    card.classList.add('next');
                } else if (diff < -1) {
                    card.classList.add('far-prev');
                } else if (diff > 1) {
                    card.classList.add('far-next');
                }
            });

            // Update pagination dots
            if (clipsPagination) {
                const dots = clipsPagination.querySelectorAll('.clips-dot');
                dots.forEach((dot, idx) => {
                    dot.classList.toggle('active', idx === currentClipIndex);
                });
            }
        }

        // Card Click Handler: Side card rotates to center; Active center card opens video modal
        clipCards.forEach((card, idx) => {
            card.addEventListener('click', (e) => {
                if (idx !== currentClipIndex) {
                    e.preventDefault();
                    e.stopPropagation();
                    updateCarousel(idx);
                } else {
                    // Center active card clicked - open video if available
                    const videoSrc = card.getAttribute('data-video-src');
                    if (videoSrc && clipModal && clipVideo) {
                        clipVideo.querySelector('source').setAttribute('src', videoSrc);
                        clipVideo.load();
                        clipModal.classList.add('active');
                        document.body.classList.add('modal-open');
                        if (typeof lenis !== 'undefined' && lenis) lenis.stop();
                        clipVideo.play();
                    }
                }
            });
        });

        // Prev / Next Button Listeners (Floating & Dock)
        function handlePrev(e) {
            if (e) e.stopPropagation();
            updateCarousel(currentClipIndex - 1);
        }

        function handleNext(e) {
            if (e) e.stopPropagation();
            updateCarousel(currentClipIndex + 1);
        }

        if (clipsPrevBtn) clipsPrevBtn.addEventListener('click', handlePrev);
        if (clipsNextBtn) clipsNextBtn.addEventListener('click', handleNext);
        if (dockPrevBtn) dockPrevBtn.addEventListener('click', handlePrev);
        if (dockNextBtn) dockNextBtn.addEventListener('click', handleNext);

        // Swipe & Touch Gestures
        let touchStartX = 0;
        let touchEndX = 0;
        clipsStage.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        clipsStage.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            const diff = touchStartX - touchEndX;
            if (Math.abs(diff) > 45) {
                if (diff > 0) {
                    updateCarousel(currentClipIndex + 1);
                } else {
                    updateCarousel(currentClipIndex - 1);
                }
            }
        }, { passive: true });

        // Autoplay Loop with Pause on Hover
        function startAutoplay() {
            if (autoplayTimer) clearInterval(autoplayTimer);
            autoplayTimer = setInterval(() => {
                updateCarousel(currentClipIndex + 1);
            }, 5000);
        }

        function stopAutoplay() {
            if (autoplayTimer) {
                clearInterval(autoplayTimer);
                autoplayTimer = null;
            }
        }

        const clipsWrapper = document.querySelector('.clips-carousel-wrapper');
        if (clipsWrapper) {
            clipsWrapper.addEventListener('mouseenter', stopAutoplay);
            clipsWrapper.addEventListener('mouseleave', startAutoplay);
        }

        startAutoplay();
        updateCarousel(0);
    }

    // Close video clip modal
    function closeClipModal() {
        if (clipModal) clipModal.classList.remove('active');
        if (clipVideo) {
            clipVideo.pause();
            clipVideo.currentTime = 0;
        }
        document.body.classList.remove('modal-open');
        if (typeof lenis !== 'undefined' && lenis) lenis.start();
    }

    if (clipModalClose) clipModalClose.addEventListener('click', closeClipModal);
    if (clipModal) {
        clipModal.addEventListener('click', (e) => {
            if (e.target === clipModal) closeClipModal();
        });
    }

    // Escape key closes video modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && clipModal && clipModal.classList.contains('active')) {
            closeClipModal();
        }
    });

    // GSAP entrance animation for clip carousel wrapper
    const clipSection = document.querySelector('.speaker-clips-section');
    if (clipSection && typeof ScrollTrigger !== 'undefined') {
        gsap.from('.clips-carousel-wrapper', {
            scrollTrigger: {
                trigger: '.speaker-clips-section',
                start: 'top 80%',
                once: true
            },
            y: 40,
            opacity: 0,
            duration: 0.8,
            ease: 'power3.out'
        });
    }

    /* --- Speakers Section: Single-Line Horizontal Carousel --- */
    const accordionTrack = document.getElementById('horizontal-accordion');
    const slotPrevBtn = document.getElementById('slot-prev');
    const slotNextBtn = document.getElementById('slot-next');

    if (accordionTrack) {
        gsap.set(accordionTrack, { clearProps: "x,transform" });

        // Prev & Next Horizontal Navigation Buttons
        if (slotPrevBtn) {
            slotPrevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                accordionTrack.scrollBy({ left: -380, behavior: 'smooth' });
            });
        }
        if (slotNextBtn) {
            slotNextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                accordionTrack.scrollBy({ left: 380, behavior: 'smooth' });
            });
        }

        // Drag to Scroll Physics
        let isDown = false;
        let startX;
        let scrollLeft;
        let isDragging = false;

        accordionTrack.addEventListener('mousedown', (e) => {
            isDown = true;
            isDragging = false;
            startX = e.pageX - accordionTrack.offsetLeft;
            scrollLeft = accordionTrack.scrollLeft;
        });

        accordionTrack.addEventListener('mouseleave', () => {
            isDown = false;
        });

        accordionTrack.addEventListener('mouseup', () => {
            isDown = false;
        });

        accordionTrack.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - accordionTrack.offsetLeft;
            const walk = (x - startX) * 1.5;
            if (Math.abs(walk) > 5) isDragging = true;
            accordionTrack.scrollLeft = scrollLeft - walk;
        });
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
            if (imgContainer) imgContainer.style.backgroundImage = data.image;
            
            document.body.classList.add('modal-open');
            if (typeof lenis !== 'undefined' && lenis) lenis.stop();

            const speakerRight = speakerOverlay.querySelector('.profile-right');
            if (speakerRight) speakerRight.scrollTop = 0;
            speakerOverlay.classList.add('open');
            
            gsap.fromTo('#speaker-overlay .profile-right > *', 
                { opacity: 0, y: 30 }, 
                { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, delay: 0.2, ease: "power3.out" }
            );
        }
    }

    const speakerCards = document.querySelectorAll('.speakers-hall .accordion-item');
    speakerCards.forEach(card => {
        card.addEventListener('click', (e) => {
            // Only trigger if not dragging
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

            speakerCards.forEach(card => {
                const session = card.getAttribute('data-session');
                if (filter === 'all' || session === filter) {
                    card.style.display = 'flex';
                    gsap.fromTo(card, 
                        { opacity: 0, scale: 0.95 }, 
                        { opacity: 1, scale: 1, duration: 0.4, ease: "power2.out" }
                    );
                } else {
                    card.style.display = 'none';
                }
            });

            if (accordionTrack) {
                accordionTrack.scrollTo({ left: 0, behavior: 'smooth' });
            }

            if (typeof ScrollTrigger !== 'undefined') {
                ScrollTrigger.refresh();
            }
        });
    });

    /* --- Team Profile Overlay --- */
    const teamOverlay = document.getElementById('team-overlay');
    const closeTeamProfileBtn = document.querySelector('.close-team-profile');
    
    const teamData = {
        'rakhi': {
            name: 'Dr. Rakhi Sharma',
            designation: 'Faculty Advisor',
            about: 'She is a passionate academic and lifelong learner with a PhD in Venture Capital Management. With over 18 years in education, she is known for her leadership, resilience, and inspiring presence. She is deeply committed to empowering people with creativity, confidence, and innovation.',
            achievements: [
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
            designation: 'Head of BBA Department',
            about: 'With over 7 years of experience in academia, research, and institutional innovation, he specializes in building entrepreneurial mindsets, empowering students with real-world business frameworks, and bridging the gap between education and industry.',
            achievements: [
                'Head of BBA Department, Jai Hind College.',
                'Over 7 years of experience in academia, research, and institutional innovation.',
                'Specializes in building entrepreneurial mindsets and real-world business frameworks.',
                'Instrumental in bridging the gap between higher education and corporate industry.'
            ],
            quote: '"Bridging education and industry empowers students to build real-world business frameworks."',
            image: 'url("Prateek kumar sir.webp")'
        },
        'siya': {
            name: 'Siya Raveendran',
            designation: 'Joint Secretary Media',
            about: 'Every idea has the potential to leave a lasting impact. For me, media is about bringing those ideas to life through thoughtful storytelling, purposeful design, and meaningful branding. As the Media Vice President of the Jai Hind Business Conclave 2027, I lead the conclave’s creative vision and digital presence, ensuring every campaign reflects our identity with clarity and consistency.',
            achievements: [
                'Built cohesive brand identities and designed supporting materials for major collegiate events.',
                'Skilled in capturing and creating engaging visual content via photography and videography.',
                'Proven ability to bring abstract ideas to life through compelling and authentic creative narratives.',
                'Driven by a strong commitment to producing impactful and highly memorable work.'
            ],
            quote: '"Design is the silent ambassador of your brand."',
            image: 'url("siya.webp")'
        },
        'ananya': {
            name: 'Ananya Murali',
            designation: 'Joint Secretary Events',
            about: 'Some people collect souvenirs—I collect stories, ideas, and events. Whether it\'s getting lost in the pages of a good book, expressing myself through creative writing, or spending hours perfecting an event plan, there\'s always something exciting to create.',
            achievements: [
                'A trained Bharatanatyam dancer, avid reader, and creative writer.',
                'Former Joint Secretary for MUN who has hosted, organised, and won multiple MUNs across the state.',
                'Articles and stories published in magazines across India.',
                'Passionate about leadership, collaboration, and creating meaningful experiences through creativity and communication.'
            ],
            quote: '"Great events are not just planned, they are crafted with passion."',
            image: 'url("ananya.webp")'
        },
        'saad': {
            name: 'Saad Khan',
            designation: 'Student Joint Secretary for Marketing',
            about: 'Between assignments and college events, I developed a new habit: overanalyzing ideas, decisions, and conversations. A curious individual with interests spanning business strategy, management, marketing, public policy, and economic transformation. I enjoy understanding how organizations operate and I love gaining new and practical experiences from wherever possible. Experiences across research, content, management and analysis. From structuring ideas and studying business models to supporting conversations.',
            achievements: [
                'Intern at Reliance, Dainik Bhaskar, Muskurahat foundation, Club terracota.',
                'Founder and Co-founder of Project Ilm and Badlaav ki Lehar focusing on workshops with underprivileged children.',
                'Patent holder.'
            ],
            quote: '"Marketing is no longer about the stuff that you make, but about the stories you tell."',
            image: 'url("saad jbc.webp")'
        },
        'mehaek': {
            name: 'Mahek Zaveri',
            designation: 'Student Secretary',
            about: 'Some of the most defining moments in my journey began with a simple “yes.” That one word led me from being a part of the Jai Hind Business Conclave to hosting JBC 2026, and today, to serving as its President. Each experience strengthens my belief that growth begins when we choose curiosity over comfort and action over hesitation.\n\nAs I step into this role, my goal isn’t just to organize another edition of JBC but to build a legacy that inspires innovation, challenges convention, and creates opportunities for everyone who chooses to be a part of it.',
            achievements: [
                'President, Jai Hind Business Conclave (2027).',
                'Host, Jai Hind Business Conclave 2026.',
                'Secured 99.60 percentile in MAH BBA CET.',
                'Maintained a 9.73 SGPA in BBA at Jai Hind College.',
                'Conducted a research project on Startup Human Capital Index (HCI) and Social Capital Index (SCI), designing variables and frameworks while carrying out extensive primary research to analyse startup ecosystems.',
                'Headed Cost Analysis for the student startup project ShareMiles, developing pricing models and financial projections.',
                'Class Representative, FY BBA, Jai Hind College.'
            ],
            quote: '"Growth begins when we choose curiosity over comfort and action over hesitation."',
            image: 'url("shruti_page-0001.webp")'
        },
        'nishi': {
            name: 'Nishi Pawar',
            designation: 'Deputy Secretary',
            about: 'Stepping into the role of Deputy Secretary means being the vital link that holds multiple creative and operational teams together. My focus has always been on operational excellence and ensuring that every minor detail aligns with our overarching premium brand identity.',
            achievements: [
                'Managed core operational workflows ensuring seamless event execution.',
                'Coordinated across 8+ departments to maintain structural harmony.',
                'Played a pivotal role in scaling the conclave\'s national outreach.'
            ],
            quote: '"Excellence is not an act, but a continuous habit of attention to detail."',
            image: 'url("nishi.webp")'
        },
        'tithi': {
            name: 'Tithi Jain',
            designation: 'Joint Secretary Hospitality',
            about: 'Hospitality is the invisible thread that elevates a good event to a truly premium experience. I am passionate about creating memorable, luxurious environments where guests, speakers, and delegates feel uniquely valued from the moment they step through the doors.',
            achievements: [
                'Curated and managed the luxury experience at Taj President for 500+ attendees.',
                'Designed the VIP handling protocols for CEOs and industry veterans.',
                'Ensured seamless logistical flow for all hospitality-related operations.'
            ],
            quote: '"Hospitality is simply an opportunity to show love and care."',
            image: 'url("tithi.webp")'
        },
        'meesha': {
            name: 'Meesha Rajpal',
            designation: 'Joint Secretary Public Relations',
            about: 'Hi, I’m Meesha. Professionally, I overthink. Unprofessionally, I also overthink. You’ll usually find me planning an event, replying to a million WhatsApp messages, or convincing someone to join my team.\n\nI believe every experience, whether big or small, contributes towards growth and progress, which is why I always try to step out of my comfort zone and explore new opportunities to learn.\n\nCommitted, dedicated, and passionate about the things I genuinely believe in, I value consistency, teamwork, and continuous self-improvement.',
            achievements: [
                'Arangetram completed (8 years Bharatanatyam + Master\'s degree).',
                'FMBH & JBC Core Member (FYBBA).',
                'Cultural Captain in High School.',
                'Contingent Lead for Immaculata (Interschool Flagship Fest).'
            ],
            quote: '"Every experience, whether big or small, contributes towards growth when you step out of your comfort zone."',
            image: 'url("meesha.webp")'
        },
        'shruti': {
            name: 'Shruti Katap',
            designation: 'Joint Secretary Legal & Finance',
            about: 'I’ve always been driven by a simple instinct: wherever I put my energy, I go all in. Whether I was diving hands-on into our family business, capturing memories behind a lens, or leading event teams right through school and junior college, my focus has always been on creating real value.\n\nWhen I reached university, joining the Entrepreneurship Cell was my chance to take that drive further. I jumped straight into the action running media initiatives, juggling high-pressure operations, and handling guest relations right from day one.\n\nBut the real turning point was with JBC. Onboarding two major panelists completely on my own proved what genuine ownership looks like. For me, that milestone shifted everything from working in a committee to investing in it. That’s why I stayed—to pour that momentum right back into the team, elevate the ecosystem, and ensure we don\'t just run great events, but build something legacy-worthy together.',
            achievements: [
                'Onboarded two major industry panelists independently for Jai Hind Business Conclave.',
                'Ran media initiatives, high-pressure operations, and guest relations at the Entrepreneurship Cell.',
                'Captured visual narratives while managing family business operations.',
                'Dedicated to building legacy-worthy corporate platforms and elevating student ecosystems.'
            ],
            quote: '"Growth begins when we choose curiosity over comfort and shift from working in a committee to investing in it."',
            image: 'url("mahek.webp")'
        },
        'yash': {
            name: 'Yash Bhamre',
            designation: 'Joint Secretary Operations',
            about: 'Coming from a STEM background, I bring analytical thinking, structured problem-solving, and a results-driven approach. At Jai Hind College, I represented the institution as a Top 10 finalist at the All India IRM GOER 2026–27, competing against 100+ colleges nationwide. I aim to pursue my career in the Financial field and am a CFA Level I Candidate. I have contributed to the successful execution of flagship events through the Public Relations Department at Jai Hind Business Conclave and the Executions Departments of Talaash and Novus.',
            achievements: [
                'Top 10 Finalist at All India IRM GOER 2026–27 (competing against 100+ colleges nationwide).',
                'CFA Level I Candidate.',
                'Qualified the highly competitive NDA Written Examination.',
                'Qualified IMU-CET (Merchant Navy) - AIR 6760.',
                'Won multiple MUN and WEF competitions across JC and FY.',
                'Emerging Debate Champion during Junior College.'
            ],
            quote: '"Analytical thinking and structured problem-solving bridge STEM precision with financial vision."',
            image: 'url("yash.webp")'
        },
        // 2025 CORE TEAM (LEGACY EDITION PROFILES)
        'hamza_2025': {
            name: 'Hamza Bamboat',
            designation: 'Secretary (2025 Core)',
            about: 'Leading the Jai Hind Business Conclave 2025 edition, driving organizational growth, strategic partnerships, and delivering one of the most successful conclaves in JBC history.',
            achievements: [
                'Secretary, Jai Hind Business Conclave 2025.',
                'Expanded inter-collegiate partnerships across major Mumbai institutions.',
                'Pioneered strategic corporate alliances for national reach.'
            ],
            quote: '"Leadership is about empowering teams to turn vision into impact."',
            image: 'url("speaker session final.webp")'
        },
        'karishma_2025': {
            name: 'Karishma Peswani',
            designation: 'Joint Secretary (2025 Core)',
            about: 'Pivotal in managing core operations, cross-department coordination, and maintaining structural execution across all conclave events for JBC 2025.',
            achievements: [
                'Joint Secretary, Jai Hind Business Conclave 2025.',
                'Coordinated operational workflows across 8+ student departments.',
                'Maintained structural excellence throughout event planning and execution.'
            ],
            quote: '"Operational harmony is the foundation of every memorable event."',
            image: 'url("Panelist final.webp")'
        },
        'sidhveer_2025': {
            name: 'Sidhveer Wadhwa',
            designation: 'Joint Secretary Marketing (2025 Core)',
            about: 'Spearheaded marketing strategies, brand partnerships, and audience acquisition for the 2025 conclave, expanding delegate enrollment exponentially.',
            achievements: [
                'Joint Secretary Marketing, Jai Hind Business Conclave 2025.',
                'Drove marketing campaigns reaching over 10,000+ students.',
                'Forged strategic brand sponsorships across retail and finance.'
            ],
            quote: '"Strategic marketing transforms great ideas into widespread movements."',
            image: 'url("Sidhveer Wadhwa.webp")'
        },
        'sanaa_2025': {
            name: 'Sanaa Punwani',
            designation: 'Joint Secretary Media (2025 Core)',
            about: 'Directed media production, creative branding, and visual storytelling across digital and physical conclave platforms during JBC 2025.',
            achievements: [
                'Joint Secretary Media, Jai Hind Business Conclave 2025.',
                'Curated digital media assets and video campaigns.',
                'Managed press releases and digital presence.'
            ],
            quote: '"Visual storytelling gives identity and voice to every milestone."',
            image: 'url("Sanaa Punwani.webp")'
        },
        'keravi_2025': {
            name: 'Kairavi Javeria',
            designation: 'Joint Secretary Creatives (2025 Core)',
            about: 'Led the creative design team, curating visual aesthetics, stage design, and branding materials for JBC 2025.',
            achievements: [
                'Joint Secretary Creatives, Jai Hind Business Conclave 2025.',
                'Designed stage aesthetics and visual identity.',
                'Supervised graphic design and editorial layouts.'
            ],
            quote: '"Creativity is intelligence having fun in design."',
            image: 'url("corporate network.webp")'
        },
        'aditi_2025': {
            name: 'Aditi Thite',
            designation: 'Joint Secretary Events (2025 Core)',
            about: 'Curated and executed high-impact speaker sessions, panel discussions, and inter-collegiate business competitions for JBC 2025.',
            achievements: [
                'Joint Secretary Events, Jai Hind Business Conclave 2025.',
                'Managed speaker sessions with leading CEOs and investors.',
                'Organized flagship business competitions.'
            ],
            quote: '"Meticulous planning and passion turn events into unforgettable experiences."',
            image: 'url("aaditi thite.webp")'
        },
        'hussain_2025': {
            name: 'Hussain Mama Wala',
            designation: 'Joint Secretary Operations (2025 Core)',
            about: 'Managed ground logistics, venue setup, and operational security for the 2025 conclave.',
            achievements: [
                'Joint Secretary Operations, Jai Hind Business Conclave 2025.',
                'Handled ground logistics and venue safety.',
                'Coordinated real-time event schedules.'
            ],
            quote: '"Precision in operations ensures smooth execution under pressure."',
            image: 'url("Hussain Formal photo.webp")'
        },
        'janhavi_2025': {
            name: 'Janhavi Pokharkar',
            designation: 'Joint Secretary Hospitality (2025 Core)',
            about: 'Overseeing supply chain, venue logistics, and hospitality infrastructure for speakers and delegates during JBC 2025.',
            achievements: [
                'Joint Secretary Hospitality, Jai Hind Business Conclave 2025.',
                'Managed hospitality transport and guest accommodations.',
                'Streamlined supply chain logistics.'
            ],
            quote: '"Seamless logistics elevate guest comfort and event workflow."',
            image: 'url("Janhavi Pokharkar New.webp")'
        },
        'tanisha_2025': {
            name: 'Tanisha Hemdev',
            designation: 'Joint Secretary Outreach (2025 Core)',
            about: 'Coordinated operational workflows, volunteer management, and stage execution during JBC 2025.',
            achievements: [
                'Joint Secretary Outreach, Jai Hind Business Conclave 2025.',
                'Supervised volunteer teams and back-stage management.',
                'Ensured seamless transition between sessions.'
            ],
            quote: '"Consistency and teamwork drive operational success."',
            image: 'url("Tanisha Hemdev.webp")'
        },
        'zara_2025': {
            name: 'Zara Zatakia',
            designation: 'Joint Secretary Public Relations (2025 Core)',
            about: 'Headed public relations, media communications, and delegate engagement, expanding JBC\'s national visibility and institutional relations.',
            achievements: [
                'Joint Secretary Public Relations, Jai Hind Business Conclave 2025.',
                'Handled external media communications.',
                'Fostered student engagement across national colleges.'
            ],
            quote: '"Authentic relationships and strong storytelling build enduring legacy brands."',
            image: 'url("Zara Zatakia.webp")'
        },
        'husain_u_2025': {
            name: 'Husain Udaipurwala',
            designation: 'Joint Secretary Legal & Finance (2025 Core)',
            about: 'Managed financial budgeting, sponsorship accounting, and legal compliance for JBC 2025.',
            achievements: [
                'Joint Secretary Legal & Finance, Jai Hind Business Conclave 2025.',
                'Oversaw conclave budget auditing and legal contracts.',
                'Ensured financial compliance across all event verticals.'
            ],
            quote: '"Financial integrity and legal compliance build institutional trust."',
            image: 'url("HUSAIN ZOHAIR UDAIPURWALA.webp")'
        }
    };

    // Predecessor <-> Successor Interactive Mapping
    const successorMap = {
        'hamza_2025': { targetId: 'mehaek', label: 'View Successor: Mahek Zaveri (2026 Core) →' },
        'karishma_2025': { targetId: 'nishi', label: 'View Successor: Nishi Pawar (2026 Core) →' },
        'sidhveer_2025': { targetId: 'saad', label: 'View Successor: Saad Khan (2026 Core) →' },
        'sanaa_2025': { targetId: 'siya', label: 'View Successor: Siya Raveendran (2026 Core) →' },
        'keravi_2025': { targetId: 'siya', label: 'View Successor: Siya Raveendran (2026 Core) →' },
        'aditi_2025': { targetId: 'ananya', label: 'View Successor: Ananya Murali (2026 Core) →' },
        'hussain_2025': { targetId: 'yash', label: 'View Successor: Yash Bhamre (2026 Core) →' },
        'janhavi_2025': { targetId: 'tithi', label: 'View Successor: Tithi Jain (2026 Core) →' },
        'tanisha_2025': { targetId: 'yash', label: 'View Successor: Yash Bhamre (2026 Core) →' },
        'zara_2025': { targetId: 'meesha', label: 'View Successor: Meesha Rajpal (2026 Core) →' },
        'husain_u_2025': { targetId: 'shruti', label: 'View Successor: Shruti Katap (2026 Core) →' },

        'mehaek': { targetId: 'hamza_2025', label: '← View Predecessor: Hamza Bamboat (2025 Core)' },
        'nishi': { targetId: 'karishma_2025', label: '← View Predecessor: Karishma Peswani (2025 Core)' },
        'saad': { targetId: 'sidhveer_2025', label: '← View Predecessor: Sidhveer Wadhwa (2025 Core)' },
        'siya': { targetId: 'sanaa_2025', label: '← View Predecessor: Sanaa Punwani (2025 Core)' },
        'ananya': { targetId: 'aditi_2025', label: '← View Predecessor: Aditi Thite (2025 Core)' },
        'tithi': { targetId: 'janhavi_2025', label: '← View Predecessor: Janhavi Pokharkar (2025 Core)' },
        'meesha': { targetId: 'zara_2025', label: '← View Predecessor: Zara Zatakia (2025 Core)' },
        'shruti': { targetId: 'husain_u_2025', label: '← View Predecessor: Husain Udaipurwala (2025 Core)' },
        'yash': { targetId: 'hussain_2025', label: '← View Predecessor: Hussain Mama Wala (2025 Core)' }
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
        document.querySelector('.team-profile-image').style.backgroundImage = data.image;

        // Populate Successor / Predecessor Switcher Button inside Modal
        const successorBtn = document.getElementById('team-successor-btn');
        const successorBlock = document.querySelector('.team-successor-block');
        if (successorBtn && successorBlock) {
            if (successorMap[teamId]) {
                successorBlock.style.display = 'block';
                successorBtn.innerText = successorMap[teamId].label;
            } else {
                successorBlock.style.display = 'none';
            }
        }
    }

    const successorBtn = document.getElementById('team-successor-btn');
    if (successorBtn) {
        successorBtn.addEventListener('click', () => {
            if (currentOpenTeamId && successorMap[currentOpenTeamId]) {
                const targetId = successorMap[currentOpenTeamId].targetId;
                gsap.to('#team-overlay .profile-right > *', {
                    opacity: 0,
                    y: -15,
                    duration: 0.3,
                    onComplete: () => {
                        populateTeamModal(targetId);
                        const teamRight = teamOverlay.querySelector('.profile-right');
                        if (teamRight) teamRight.scrollTop = 0;
                        gsap.fromTo('#team-overlay .profile-right > *',
                            { opacity: 0, y: 20 },
                            { opacity: 1, y: 0, duration: 0.4, stagger: 0.06, ease: "power2.out" }
                        );
                    }
                });
            }
        });
    }

    /* --- Team Edition Filter Tabs (2026 vs 2025) --- */
    const editionBtns = document.querySelectorAll('.team-edition-filters .edition-btn');
    const editorialCards = document.querySelectorAll('.editorial-grid .team-card');

    editionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            editionBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.getAttribute('data-edition-filter');

            editorialCards.forEach(card => {
                const ed = card.getAttribute('data-edition');
                if (ed === 'both' || ed === filter) {
                    card.style.display = 'block';
                    gsap.fromTo(card, { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.4, ease: "power2.out" });
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

    const teamCardsList = document.querySelectorAll('.team-card');
    
    teamCardsList.forEach(card => {
        card.addEventListener('click', () => {
            const teamId = card.getAttribute('data-team');
            if (teamId && teamData[teamId]) {
                populateTeamModal(teamId);
                
                document.body.classList.add('modal-open');
                lenis.stop();
                
                const teamRight = teamOverlay.querySelector('.profile-right');
                if (teamRight) teamRight.scrollTop = 0;
                if(teamOverlay) teamOverlay.classList.add('open');
                
                // Animate content in
                gsap.fromTo('#team-overlay .profile-right > *', 
                    { opacity: 0, y: 30 }, 
                    { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, delay: 0.2, ease: "power3.out" }
                );
            }
        });
    });

    if(closeTeamProfileBtn) {
        closeTeamProfileBtn.addEventListener('click', () => {
            teamOverlay.classList.remove('open');
            document.body.classList.remove('modal-open');
            lenis.start();
        });
    }

    /* --- Theatre & Venue Mode Lock-in Sections --- */
    const lockInSections = document.querySelectorAll('.theatre-mode, .venue-mode');

    lockInSections.forEach((section) => {
        const wrapper = section.querySelector('.theatre-sticky-wrapper, .venue-sticky-wrapper');
        const video = section.querySelector('video');

        if (wrapper && video) {
            ScrollTrigger.create({
                trigger: section,
                start: "top top",
                end: "+=150%", // Increased duration to ensure a solid lock-in
                pin: true,
                onEnter: () => {
                    wrapper.classList.add('playing');
                    video.play().catch(err => console.log('Video play interrupted:', err));
                },
                onLeaveBack: () => {
                    wrapper.classList.remove('playing');
                    video.pause();
                },
                onLeave: () => {
                    wrapper.classList.remove('playing');
                    video.pause();
                },
                onEnterBack: () => {
                    wrapper.classList.add('playing');
                    video.play().catch(err => console.log('Video play interrupted:', err));
                }
            });
        }
    });

    /* --- Core Team Grid Reveal --- */
    const teamCards = document.querySelectorAll('.team-card');
    
    gsap.fromTo(teamCards, 
        { opacity: 0, y: 50 },
        {
            opacity: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.1,
            ease: "power2.out",
            scrollTrigger: {
                trigger: ".editorial-grid",
                start: "top 80%"
            }
        }
    );

    /* --- Experience Cards Reveal --- */
    const expCards = document.querySelectorAll('.exp-card');
    
    gsap.fromTo(expCards,
        { opacity: 0, scale: 0.95 },
        {
            opacity: 1,
            scale: 1,
            duration: 1,
            stagger: 0.2,
            ease: "power2.out",
            scrollTrigger: {
                trigger: ".experience-cards",
                start: "top 80%"
            }
        }
    );

    /* --- SEO FAQ Accordion Functionality --- */
    const faqItems = document.querySelectorAll('.faq-item');
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
                
                // Recalculate ScrollTrigger measurements
                setTimeout(() => {
                    if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
                }, 400);
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

    /* --- Mobile Menu Hamburger Toggle with X Animation --- */
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinksContainer = document.querySelector('.nav-links');

    if (menuToggle && navLinksContainer) {
        function toggleMobileMenu() {
            menuToggle.classList.toggle('active');
            navLinksContainer.classList.toggle('active');
            const isOpen = menuToggle.classList.contains('active');
            menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        }

        menuToggle.addEventListener('click', toggleMobileMenu);

        // Keyboard: Enter and Space activate the hamburger
        menuToggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleMobileMenu();
            }
        });

        // Close mobile menu when a nav link is clicked
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (navLinksContainer.classList.contains('active')) {
                    menuToggle.classList.remove('active');
                    navLinksContainer.classList.remove('active');
                    menuToggle.setAttribute('aria-expanded', 'false');
                }
            });
        });
    }

    /* --- Lazy Loading Background Images (IntersectionObserver) --- */
    // Convert below-fold inline background-images to deferred loading
    const lazyTargetSelectors = '.clip-thumbnail, .exp-img, .orbiting-photo-cube, .taj-media-card, .cinematic-crop';
    const lazyTargets = document.querySelectorAll(lazyTargetSelectors);

    if (lazyTargets.length > 0 && 'IntersectionObserver' in window) {
        lazyTargets.forEach(el => {
            const inlineBg = el.style.backgroundImage;
            if (inlineBg && inlineBg !== 'none') {
                el.setAttribute('data-lazy-bg', inlineBg);
                el.style.backgroundImage = 'none';
                el.style.backgroundColor = 'rgba(242, 242, 245, 0.85)';
            }
        });

        const lazyObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const bgVal = el.getAttribute('data-lazy-bg');
                    if (bgVal) {
                        el.style.backgroundImage = bgVal;
                        el.style.backgroundColor = '';
                        el.removeAttribute('data-lazy-bg');
                        el.style.transition = 'opacity 0.5s ease';
                    }
                    lazyObserver.unobserve(el);
                }
            });
        }, {
            rootMargin: '300px 0px',
            threshold: 0.01
        });

        lazyTargets.forEach(el => {
            if (el.hasAttribute('data-lazy-bg')) {
                lazyObserver.observe(el);
            }
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

    // Refresh ScrollTrigger when all fonts and assets load
    window.addEventListener('load', () => {
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
    });
});
