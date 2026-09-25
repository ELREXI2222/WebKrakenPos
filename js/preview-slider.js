/* ============================================================
   Vista previa deslizante de Krato POS
   ------------------------------------------------------------
   El carrusel funciona sin JavaScript gracias al scroll-snap
   definido en css/styles.css (swipe nativo en móvil). Este
   archivo solo añade flechas, puntos, teclado, autoplay y el
   evento GA4 de navegación.
   ============================================================ */
(function () {
    'use strict';

    var slider = document.getElementById('preview-slider');
    if (!slider) return;

    var track = slider.querySelector('.slider-track');
    var slides = Array.prototype.slice.call(slider.querySelectorAll('.slide'));
    var dots = Array.prototype.slice.call(slider.querySelectorAll('.slider-dots button'));
    var prevBtn = slider.querySelector('.slider-nav.prev');
    var nextBtn = slider.querySelector('.slider-nav.next');

    if (!track || slides.length < 2) return;

    var AUTOPLAY_MS = 7000;
    var SCROLL_TOLERANCE = 2;       /* px de margen para dar por alcanzado el destino */
    var SCROLL_SAFETY_MS = 2500;    /* red de seguridad si el scroll nunca llega */
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    var current = 0;
    var target = 0;
    var autoplayId = null;
    var safetyId = null;
    var resizeId = null;
    var programmatic = false;
    var hovering = false;
    var inView = true;
    var paused = false;

    /* Posición real de cada slide dentro de la pista */
    function offsetOf(index) {
        return slides[index].offsetLeft - slides[0].offsetLeft;
    }

    function setActive(index) {
        var i;

        for (i = 0; i < slides.length; i++) {
            if (i === index) {
                slides[i].classList.add('is-active');
            } else {
                slides[i].classList.remove('is-active');
            }
        }

        for (i = 0; i < dots.length; i++) {
            if (i === index) {
                dots[i].classList.add('is-active');
                dots[i].setAttribute('aria-current', 'true');
            } else {
                dots[i].classList.remove('is-active');
                dots[i].removeAttribute('aria-current');
            }
        }
    }

    /* Evento GA4 (se reutiliza el gtag ya cargado en index.html) */
    function trackEvent(index) {
        if (typeof window.gtag !== 'function') return;

        window.gtag('event', 'ver_preview', {
            'event_category': 'software',
            'event_label': 'vista_' + (index + 1),
            'value': index + 1
        });
    }

    function goTo(index, userAction) {
        current = (index + slides.length) % slides.length;
        target = current;

        programmatic = true;
        window.clearTimeout(safetyId);
        safetyId = window.setTimeout(function () {
            if (!programmatic) return;

            /* Red de seguridad: reafirmamos el destino por si el navegador
               nunca reportó la llegada (así el indicador no salta atrás) */
            track.scrollTo({ left: offsetOf(target), behavior: 'auto' });
            current = target;
            setActive(current);

            /* Y liberamos el bloqueo para que el próximo swipe del usuario
               vuelva a actualizar los indicadores */
            safetyId = window.setTimeout(function () {
                programmatic = false;
            }, 1200);
        }, SCROLL_SAFETY_MS);

        track.scrollTo({
            left: offsetOf(current),
            behavior: reduceMotion.matches ? 'auto' : 'smooth'
        });

        setActive(current);

        if (userAction) trackEvent(current);
    }

    /* El usuario tomó el control: dejamos de seguir el scroll programático */
    function userTookOver() {
        programmatic = false;
        window.clearTimeout(safetyId);
    }

    /* Sincroniza puntos y slide activo cuando el usuario desliza a mano */
    function syncFromScroll() {
        var left = track.scrollLeft;

        if (programmatic) {
            /* El scroll programático termina al alcanzar el destino, no por tiempo */
            if (Math.abs(offsetOf(target) - left) <= SCROLL_TOLERANCE) {
                programmatic = false;
                window.clearTimeout(safetyId);
                if (current !== target) {
                    current = target;
                    setActive(current);
                }
            }
            return;
        }

        var best = current;
        var bestDist = Infinity;

        for (var i = 0; i < slides.length; i++) {
            var dist = Math.abs(offsetOf(i) - left);
            if (dist < bestDist) {
                bestDist = dist;
                best = i;
            }
        }

        if (best !== current) {
            current = best;
            target = best;
            setActive(current);
        }
    }

    function next() {
        goTo(current + 1, true);
    }

    function prev() {
        goTo(current - 1, true);
    }

    /* --- Flechas --- */
    if (nextBtn) {
        nextBtn.addEventListener('click', next);
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', prev);
    }

    /* --- Puntos --- */
    for (var d = 0; d < dots.length; d++) {
        (function (index) {
            dots[index].addEventListener('click', function () {
                goTo(index, true);
            });
        })(d);
    }

    /* --- Teclado (la pista tiene tabindex="0") --- */
    track.addEventListener('keydown', function (event) {
        var key = event.key;

        if (key === 'ArrowRight') {
            event.preventDefault();
            next();
        } else if (key === 'ArrowLeft') {
            event.preventDefault();
            prev();
        } else if (key === 'Home') {
            event.preventDefault();
            goTo(0, true);
        } else if (key === 'End') {
            event.preventDefault();
            goTo(slides.length - 1, true);
        }
    });

    /* --- Swipe / trackpad --- */
    track.addEventListener('scroll', syncFromScroll, { passive: true });

    /* scrollend cierra el estado programático en cuanto el navegador
       termina la animación (los navegadores que no lo soportan usan el
       margen SCROLL_TOLERANCE dentro de syncFromScroll) */
    track.addEventListener('scrollend', function () {
        programmatic = false;
        window.clearTimeout(safetyId);
        syncFromScroll();
    });

    track.addEventListener('wheel', userTookOver, { passive: true });
    track.addEventListener('touchstart', userTookOver, { passive: true });

    /* --- Autoplay --- */
    function canAutoplay() {
        return !reduceMotion.matches &&
            inView &&
            !hovering &&
            !paused &&
            !document.hidden;
    }

    function stopAutoplay() {
        if (autoplayId !== null) {
            window.clearInterval(autoplayId);
            autoplayId = null;
        }
    }

    function startAutoplay() {
        stopAutoplay();

        if (!canAutoplay()) return;

        autoplayId = window.setInterval(function () {
            goTo(current + 1, false);
        }, AUTOPLAY_MS);
    }

    /* El autoplay se pausa al pasar el mouse o al navegar con teclado */
    slider.addEventListener('mouseenter', function () {
        hovering = true;
        stopAutoplay();
    });

    slider.addEventListener('mouseleave', function () {
        hovering = false;
        startAutoplay();
    });

    slider.addEventListener('focusin', stopAutoplay);
    slider.addEventListener('focusout', startAutoplay);

    track.addEventListener('pointerdown', function () {
        userTookOver();
        paused = true;
        stopAutoplay();
    });

    window.addEventListener('pointerup', function () {
        paused = false;
        startAutoplay();
    });

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            stopAutoplay();
        } else {
            startAutoplay();
        }
    });

    if (typeof reduceMotion.addEventListener === 'function') {
        reduceMotion.addEventListener('change', function () {
            if (reduceMotion.matches) {
                stopAutoplay();
            } else {
                startAutoplay();
            }
        });
    }

    /* Solo gira en automático mientras el carrusel está a la vista */
    if ('IntersectionObserver' in window) {
        new window.IntersectionObserver(function (entries) {
            inView = entries[0].isIntersecting;

            if (inView) {
                startAutoplay();
            } else {
                stopAutoplay();
            }
        }, { threshold: 0.35 }).observe(slider);
    }

    /* Al cambiar el tamaño hay que realinear el slide activo */
    window.addEventListener('resize', function () {
        window.clearTimeout(resizeId);
        resizeId = window.setTimeout(function () {
            track.scrollTo({ left: offsetOf(current), behavior: 'auto' });
        }, 150);
    });

    /* --- Estado inicial --- */
    setActive(0);
    startAutoplay();
})();

