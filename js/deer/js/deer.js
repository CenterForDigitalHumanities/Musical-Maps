/**
 * @module DEER Data Encoding and Exhibition for RERUM (DEER)
 * @author Patrick Cuba <cubap@slu.edu>
 * @author Bryan Haberberger <bryan.j.haberberger@slu.edu>
 * @version 0.7

 * This code should serve as a basis for developers wishing to
 * use TinyThings as a RERUM proxy for an application for data entry,
 * especially within the Eventities model.
 * @see tiny.rerum.io
 */

// Add custom templates in the /templates directory

// CDN at https://centerfordigitalhumanities.github.io/deer/releases/

// Attach service worker for offline support. 
// if ('serviceWorker' in navigator) {
//     try {
//         navigator.serviceWorker.register('/serviceworker.js')
//     } catch (e) {
//         // Maybe you do not want to use a service worker?
//     }
// } else {
//    console.log('Service workers are not supported in this browser.')
    import('./entities.js')
// }

// Import custom components. The basic view.js is required for rendering.
import('../components/view/view.js')
import('../components/view/collection.js')
import('../components/view/entity.js')
import('../components/view/links.js')
