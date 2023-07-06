/**
 * Base element for rendering an entity in the DOM. The template is a simple <pre> tag with the JSON-LD data rendered in it. 
 * Developers can add their own classes by extending this or add a simpler element with a custom template.
 * 
 * @export default class DeerView
 * @definition {HTMLElement} deer-view
 * @author Patrick Cuba <cubap@slu.edu>
 * @org SLU, Research Computing Group
 */

import { default as UTILS } from '../../js/deer-utils.js'
import { default as DEER } from '../../js/deer-config.js'
import '../templates/default.js'
import DeerView from './view.js'

export default class DeerLink extends DeerView {
    static get observedAttributes() { return [DEER.KEY, DEER.ID, DEER.LINK]; }
    #options = {
        list: this.getAttribute(DEER.LIST),
        link: this.getAttribute(DEER.LINK),
        key: this.getAttribute(DEER.KEY),
        label: this.getAttribute(DEER.LABEL),
        config: DEER
    }
    constructor() {
        super()
    }
    connectedCallback() {
        const a = document.createElement('A')
        ;[...this.childNodes].forEach(child=>a.appendChild(child))
        a.classList.add('text-light')
        this.append(a)
        a.setAttribute('href',this.#options.link + this.getAttribute(DEER.ID)?.split('/').pop())
    }
    attributeChangedCallback(name, oldValue, newValue) {
        const id = this.getAttribute(DEER.ID)
        if (id === null) { return }
        this.querySelector('a')?.setAttribute('href',this.#options.link + id.split('/').pop())
    }
}

customElements.define(`deer-a`, DeerLink)

class MapLink extends DeerView {
    static get observedAttributes() { return [DEER.KEY, DEER.ID, DEER.LINK]; }
    #options = {
        list: this.getAttribute(DEER.LIST),
        link: this.getAttribute(DEER.LINK),
        key: this.getAttribute(DEER.KEY),
        label: this.getAttribute(DEER.LABEL),
        config: DEER
    }
    constructor() {
        super()
    }
    connectedCallback() {
        const a = document.createElement('A')
        ;[...this.childNodes].forEach(child=>a.appendChild(child))
        this.append(a)
        a.setAttribute('href',this.#options.link + this.getAttribute(DEER.ID))
    }
    attributeChangedCallback(name, oldValue, newValue) {
        const id = this.getAttribute(DEER.ID)
        if (id === null) { return }
        this.querySelector('a')?.setAttribute('href',this.#options.link + id)
    }
}

customElements.define(`deer-map-link`, MapLink)

