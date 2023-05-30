/**
 * @module DEER Data Encoding and Exhibition for RERUM (DEER)
 * @author Patrick Cuba <cubap@slu.edu>
 * @author Bryan Haberberger <bryan.j.haberberger@slu.edu>
 * @version 0.11

 * This code should serve as a basis for developers wishing to
 * use TinyThings as a RERUM proxy for an application for data entry,
 * especially within the Eventities model.
 * @see tiny.rerum.io
 */

// Identify an alternate config location or only overwrite some items below.
import { default as DEER } from './deer/js/deer-config.js'

// Overwrite or add certain values to the configuration to customize.

// sandbox repository URLS
DEER.URLS = {
    BASE_ID: "https://devstore.rerum.io/v1",
    CREATE: "//tinydev.rerum.io/app/create",
    UPDATE: "//tinydev.rerum.io/app/update",
    QUERY: "//tinydev.rerum.io/app/query",
    OVERWRITE: "//tinydev.rerum.io/app/overwrite",
    SINCE: "//devstore.rerum.io/v1/since"
}
// Render is probably needed by all items, but can be removed.
// CDN at https://centerfordigitalhumanities.github.io/deer/releases/
import { default as renderer, initializeDeerViews } from './deer/js/deer-render.js'

// Record is only needed for saving or updating items.
// CDN at https://centerfordigitalhumanities.github.io/deer/releases/
import { default as record, initializeDeerForms } from './deer/js/deer-record.js'

// fire up the element detection as needed
try {
    initializeDeerViews(DEER)
    initializeDeerForms(DEER)
} catch (err) {
    // silently fail if render or record is not loaded
}

export default DEER
