/**
 * Base element for rendering an entity in the DOM. The template is a simple <pre> tag with the JSON-LD data rendered in it. 
 * Developers can add their own classes by extending this or add a simpler element with a custom template.
 * 
 * @export default class DeerView
 * @definition {HTMLElement} deer-view
 * @author Patrick Cuba <cubap@slu.edu>
 * @org SLU, Research Computing Group
 */

import { UTILS, DEER } from '/js/deer/js/deer-utils.js'
import '/js/deer/components/templates/default.js'

export default class DeerCollection extends HTMLElement {
    static get observedAttributes() { return [DEER.ID, DEER.KEY, DEER.LIST, DEER.LINK, DEER.LAZY, DEER.LISTENING]; }

    #options = {
        list: this.getAttribute(DEER.LIST),
        link: this.getAttribute(DEER.LINK),
        collection: this.getAttribute(DEER.COLLECTION),
        key: this.getAttribute(DEER.KEY),
        label: this.getAttribute(DEER.LABEL),
        config: DEER
    }
    constructor() {
        super()
        this.template = DEER.TEMPLATES[this.getAttribute(DEER.TEMPLATE) ?? 'list']
    }

}

customElements.define(`deer-collection`, DeerCollection)
