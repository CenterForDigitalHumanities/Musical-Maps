/**
 * Template components like headers and footers for reuse across the site.
 * @author cubap@slu.edu
 */
const polyfill = document.createElement('script')
const ungapPolyfill = "https://cdn.skypack.dev/@ungap/custom-elements"
polyfill.setAttribute("src", ungapPolyfill)
polyfill.setAttribute("type", "module")
document.head.appendChild(polyfill)

class MmPage extends HTMLBodyElement {
#template = `
<style>mm-header{cursor:pointer;}</style>
<mm-header></mm-header>
<slot name="content">page content</slot>
<mm-footer></mm-footer>
`

    constructor(){
        super()
        this.attachShadow({mode:'open'})
        this.shadowRoot.innerHTML =this.#template
    }
    connectedCallback(){
        this.shadowRoot.querySelector('mm-header').addEventListener('click',()=>location.href='/')
    }
}

customElements.define("mm-content",MmPage, {extends:"body"})

class MmHeader extends HTMLElement {
    #headerTmpl = `
    <link rel="stylesheet" href="css/main.css">
    <header>
    <div class="text-center">
        <h1>
            Musical Map
        </h1>
        <small>University of Tennessee-Knoxville</small>
    </div>
    <ul class="container nav justify-content-around flex-column flex-md-row mb-2">
        <li class="nav-item">
            <a class="nav-link bg-light" aria-current="page" href="collections.html">View Collections</a>
        </li>
        <li class="nav-item">
            <a class="nav-link bg-light" href="people.html">People</a>
        </li>
    </ul>
    </header>
`
    constructor(){
        super()        
        this.attachShadow({mode:'open'})
        this.shadowRoot.innerHTML = this.#headerTmpl
    }
}

customElements.define("mm-header",MmHeader)

class GeoFooter extends HTMLElement {
    #footerTmpl = `
    <link rel="stylesheet" href="css/main.css">
    <footer class="w-100 text-center d-flex justify-content-around align-items-center">
        <a href="https://lib.utk.edu">
            <img class="brand" alt="UTK Logo" src="media/UTK-footer.png">
        </a>
        <a target="_blank" href="https://www.slu.edu/research/faculty-resources/research-computing.php"><img class="brand"
                alt="SLU RCG logo"
                src="https://centerfordigitalhumanities.github.io/media-assets/logos/rcg-logo.png">
                <small>&copy;2022 Research
                Computing Group</small>
        </a>
        <a target="_blank" href="https://rerum.io"><img class="brand" alt="Rerum logo"
                src="https://centerfordigitalhumanities.github.io/blog/assets/images/rerum.jpg"><small>RERUM
                v1</small></a>
    </footer>`
    constructor(){
        super()
        this.attachShadow({mode:'open'})
        this.shadowRoot.innerHTML = this.#footerTmpl
    }
}

customElements.define("mm-footer",GeoFooter)

class UserResource extends HTMLElement {
    #uriInputTmpl = `
        <div id="supplyURI" class="card">
            <header>
                Supply an existing Web Resource URI.
            </header>
            <div>
                <label>Object URI</label><input id="objURI" type="text" />
            </div>
            <footer>
                <input id="uriBtn" type="button" class="button primary" value="Use This URI" />
            </footer>
        </div>

        <div id="confirmURI" class="card is-hidden notfirst">
            <header>Resolved URI</header>
            <div>
                <input id="confirmUriBtn" type="button" class="button primary" value="Confirm URI" />
                <div id="uriPreview">

                </div>
            </div>
            <footer>

            </footer>
        </div>`

    connectedCallback() {
        this.innerHTML = this.#uriInputTmpl
        localStorage.removeItem("providedURI")
        localStorage.removeItem("userResource")
        uriBtn.addEventListener("click", this.provideTargetID)
        confirmUriBtn.addEventListener("click", this.confirmTarget)
    }

    /**
     * Take the user provided URI and check if can be resolved.
     * If so, preview the object it resolves to.  
     * If not, tell the user and let them choose whether to move forward or not.
     */ 
    async provideTargetID(e){
        if(!objURI.value){
            alert("You must provide something to target.")
            return
        }
        let target = objURI.value
        confirmURI.classList.remove("is-hidden")
        let targetObj = await fetch(target.replace(/^https?:/, location.protocol))
            .then(resp => resp.json())
            .then(obj => {
                uriPreview.innerHTML = `<pre>${JSON.stringify(obj, null, '\t')}</pre>`
                localStorage.setItem("userResource", JSON.stringify(obj)) 
                return obj
            })
            .catch(err => {
                alert("Target URI could not be resolved."
                    + " Certain data previews will not be available."
                    + " Applications that will use the data you are about to create"
                    + " will note be able to gather additional information about this targeted resource."
                    + " You can supply a different URI or continue with this one.")
                uriPreview.innerHTML = `<pre>{Not Resolvable}</pre>`
                localStorage.setItem("userResource", JSON.stringify({"@id":target})) 
                return null
            })
        //This might help mobile views
        //window.scrollTo(0, confirmURI.offsetTop)
    }

    /**
     * Cache the resource the user has confirmed they want to use so it can be used by other app components.
     * @param {type} event
     * @return {undefined}
     */
    confirmTarget(event) {
        this.closest('user-resource').setAttribute("data-uri", objURI.value)
        const e = new CustomEvent("userResourceConfirmed", {"detail":objURI.value})
        document.dispatchEvent(e)
    }
}

customElements.define("user-resource", UserResource)

class PointPicker extends HTMLElement {
    #pointPickerTmpl = `
        <div id="coordinatesCard" class="card">
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.3/dist/leaflet.css"
             integrity="sha256-kLaT2GOSpHechhsozzB+flnD+zUyjE2LlfWPgU04xyI="
             crossorigin=""/>
            <script src="https://unpkg.com/leaflet@1.9.3/dist/leaflet.js"
             integrity="sha256-WBkoXOwTeyKclOHuWtc+i2uENFpDZ9YPdf5Hf+D7ewM="
             crossorigin=""></script>
            <header title="Use the map below to pan around.  Click to be given the option to use coordinates, 
                or enter coordinates manually.">
                Use the map to select coordinates. You may also supply coordinates manually.
                <br><input id="confirmCoords" type="button" class="button primary" value="Confirm Coordinates" />
            </header>
            <div class="card-body">
                <div>
                    <label>Latitude</label>
                    <input id="leafLat" step=".000000001" type="number" />
                    <label>Longitude</label>
                    <input id="leafLong" step=".000000001" type="number" />
                </div>
                <div title="Use the map below to pan around.  Click to be given the option to use coordinates, or enter coordinates manually."
                    id="leafletPreview" class="col"></div>
            </div>
            <footer>

            </footer>
        </div>`

    connectedCallback() {
        localStorage.removeItem("geoJSON")
        this.innerHTML = this.#pointPickerTmpl
        leafLat.addEventListener("input", this.updateGeometry)
        leafLong.addEventListener("input", this.updateGeometry)
        confirmCoords.addEventListener("click", this.confirmCoordinates)
        let previewMap = L.map('leafletPreview').setView([12, 12], 2)
        L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoidGhlaGFiZXMiLCJhIjoiY2pyaTdmNGUzMzQwdDQzcGRwd21ieHF3NCJ9.SSflgKbI8tLQOo2DuzEgRQ', {
            attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
            maxZoom: 19,
            id: 'mapbox.satellite', //mapbox.streets
            accessToken: 'pk.eyJ1IjoidGhlaGFiZXMiLCJhIjoiY2pyaTdmNGUzMzQwdDQzcGRwd21ieHF3NCJ9.SSflgKbI8tLQOo2DuzEgRQ'
        }).addTo(previewMap);

        function updateGeometry(event, clickedLat, clickedLong) {
            let lat = clickedLat ? clickedLat : leafLat.value
            lat = parseInt(lat * 1000000) / 1000000
            let long = clickedLong ? clickedLong : leafLong.value
            long = parseInt(long * 1000000) / 1000000
            leafLat.value = lat
            leafLong.value = long
            if(clickedLat || clickedLong){
                event.preventDefault()
                event.stopPropagation()
                event.target.closest(".leaflet-popup").remove()
            }
        }
        
        previewMap.on('click', (e) => {
            previewMap.setView(e.latlng, 16)
            L.popup().setLatLng(e.latlng).setContent(`<div>${e.latlng.toString()}<br><button id="useCoords" class="tag is-small text-primary bd-primary">Use These</button></div>`).openOn(previewMap)
            leafletPreview.querySelector('#useCoords').addEventListener("click", (clickEvent) => {updateGeometry(clickEvent, e.latlng.lat, e.latlng.lng)})
        })
    }

    confirmCoordinates() {
        let lat = parseInt(leafLat.value * 1000000) / 1000000
        let long = parseInt(leafLong.value * 1000000) / 1000000
        let geo = {}
        if (lat && long) {
            geo.type = "Point"
            geo.coordinates = [long, lat]
        }
        else {
            alert("Supply both a latitude and a longitude")
            return false
        }
        let targetURL = document.getElementById('objURI').value
        let geoJSON = {
            "type": "Feature",
            "geometry": geo,
            "properties": {} 
        }
        const e = new CustomEvent("coordinatesConfirmed", {"detail":JSON.stringify(geoJSON)})
        document.dispatchEvent(e)
    }
}

customElements.define("point-picker", PointPicker)

class GeolocatorPreview extends HTMLElement {
    #uriInputTmpl = `
        <div class="card">
            <header>
                Here is your resource preview!
            </header>
            <div>
                <div class="resourcePreview"> </div>
            </div>
            <footer>
                <input type="button" class="createBtn button primary" value="Create"/>
                <input type="button" class="restartBtn button secondary" value="Start Over" />
            </footer>
        </div>`

    connectedCallback() {
        localStorage.removeItem("newResource")
        this.innerHTML = this.#uriInputTmpl
        if(this.getAttribute("do-save")){
            this.querySelector(".createBtn").addEventListener("click", this.saveResource)
            this.querySelector(".restartBtn").addEventListener("click", () => document.location.reload())
        }
        else{
            this.querySelector("footer").remove()
        }
    }

    // The trigger which lets this element know which type of data is ready for preview
    static get observedAttributes() { return ['resource-type'] }

    /**
     * The resource-type changed, letting the element know what kind of data is ready for preview
     * The geoJSON and userResource must be set, or this cannot build a preview.
     * */
    attributeChangedCallback(name, oldValue, newValue) {
        if(oldValue === newValue) return

        const userObj = JSON.parse(localStorage.getItem("userResource"))
        const geo = JSON.parse(localStorage.getItem("geoJSON"))
        if(!geo || !userObj) return

        let wrapper
        switch(newValue){
            case "Annotation":
                wrapper = {
                    "@context": ["http://www.w3.org/ns/anno.jsonld", "https://geojson.org/geojson-ld/geojson-context.jsonld"],
                    "type": "Annotation",
                    "motivation": "tagging",
                    "body": geo,
                    "target": userObj["@id"] ?? userObj.id ?? ""
                }
            break
            case "navPlace":
                userObj.navPlace = geo
                wrapper = JSON.parse(JSON.stringify(userObj))
            break
            default: 
                wrapper = JSON.parse(JSON.stringify(userObj))
        }
        this.querySelector(".resourcePreview").innerHTML = `<pre>${JSON.stringify(wrapper, null, '\t')}</pre>`
        localStorage.setItem("newResource", JSON.stringify(wrapper))
        // Typically when this has happened the preview is ready to be seen.
        // It may be better to let a front end handle whether they want to show this preview or not by dispatching an event.
        if(Array.from(this.classList).includes("is-hidden")){
            this.classList.remove("is-hidden")
        }
    }

    /**
     * Save the resource the user has generated so it can persist and be used elsewhere.
     * This is either a Web Annotation or a navPlace object
     * A Web Annotation can be saved outright.  A navPlace object requires a RERUM import of the provided resource.
     * @param {type} event
     * @return {undefined}
     */
    saveResource(event) {
        const resourceToSave = JSON.parse(localStorage.getItem("newResource"))
        if(resourceToSave["@id"] || resourceToSave.id){
            //You already did this!
            return
        }
        fetch("create", {
            method: "POST",
            mode: "cors",
            headers: {
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: localStorage.getItem("newResource")
        })
        .then(response => response.json())
        .then(newObj => {
            delete newObj.new_obj_state
            localStorage.setItem("newResource", JSON.stringify(newObj))
            const e = new CustomEvent("newResourceCreated", {"detail":JSON.stringify(newObj)})
            document.dispatchEvent(e)
            return newObj
        })
        .catch(err => {return null})
    }
}

customElements.define("geolocator-preview", GeolocatorPreview)
