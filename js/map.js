/* 
 * @author Bryan Haberberger
 * https://github.com/thehabes 
 */

let MAPVIEWER = {}

//Keep tracked of fetched resources.  Do not fetch resources you have already resolved.
MAPVIEWER.resourceMap = new Map()

//Keep track of how many resources you have fetched
MAPVIEWER.resourceFetchCount = 0

//Keep track of how many resources have been processed for geography
MAPVIEWER.resourceCount = 0

//Once you have fetched this many resources, fetch no more.  Helps stop infinite loops from circular references.
MAPVIEWER.resourceFetchLimit = 1000

//Once you have processed this many resources, process no more.  Helps stop infinite loops from circular references.
MAPVIEWER.resourceFindLimit = 1000

//The resource supplied via the iiif-content paramater.  All referenced values that could be resolved are resolved and embedded.
MAPVIEWER.resource = {}

//For Leaflet
MAPVIEWER.mymap = {}

//Supported Resource Types
MAPVIEWER.musicalMapTypes = ["Person", "Place", "Thing", "Event"]

//Supported Resource Types
MAPVIEWER.possibleGeoProperties = ["location"]

//MAPVIEWER specific resources to consider in logic.  Set on init()
MAPVIEWER.supportedTypes = []

//We only support Musical Map resource types with Musical Map contexts.
MAPVIEWER.musical_map_contexts = ["https://musicalmaps.rerum.io/context.json", "http://musicalmaps.rerum.io/context.json"]

//GeoJSON contexts to verify
MAPVIEWER.geojson_contexts = ["https://geojson.org/geojson-ld/geojson-context.jsonld", "http://geojson.org/geojson-ld/geojson-context.jsonld"]

MAPVIEWER.isJSON = function(obj) {
    let r = false
    let json = {}
    try {
        json = JSON.parse(JSON.stringify(obj))
        r = true
    } catch (e) {
        r = false
    }
    return r
}

/**
 * Get and combine the GeoJSON from the provided entities and props to match on.  Properties not listed in geoProps are ignored.
 * If you come across a referenced value, attempt to dereference it.  If successful, embed it to go forward with (so as not to resolve it again)
 * 
 * @param expandedEntities An array of JSON objects that have been expanded with their decriptive data.
 * @param geoProps An array of properties to check for GeoJSON.
 * @param allPropertyInstances The array of GeoJSON objects to return.  It may contain GeoJSON already.
 * 
 * @return the array of Feature Collections and/or Features
 */
MAPVIEWER.findAllFeatures = async function(expandedEntities, geoProps, allPropertyInstances = []) {
    //Check against the limits first.  If we reached any, break all loops and recursion to return the results so far.
    if(!expandedEntities){
        return []
    }
    if(MAPVIEWER.resourceCount > MAPVIEWER.resourceFindLimit){
        console.warn(`Resource processing limit [${MAPVIEWER.resourceFindLimit}] reached. Make sure your resources do not contain circular references.`)
        return allPropertyInstances
    }
    let resolved_uri = ""
    // For the eventuality that data is actually an array of data
    if (!Array.isArray(expandedEntities)) {
        expandedEntities = [expandedEntities]
    }
    // On each piece of expandedEntities, each array item in geoProps are the only properties that will contain a referenced or embedded GeoJSON object.
    // Each piece of expandedEntities is a resolved and expanded Entity as JSON.  It will not contain child properties to recurse on.
    for await (const data of expandedEntities){
        const t1 = data.type ?? data["@type"] ?? ""
        const entityLabel = data.name ?? data.label ?? data.title ?? "No Entity Label"
        MAPVIEWER.resourceCount += 1
        if(MAPVIEWER.resourceCount > MAPVIEWER.resourceFindLimit){
            console.warn(`geography lookup limit [${MAPVIEWER.resourceFindLimit}] reached`)
            return allPropertyInstances
        }
        //Loop the keys, looks for those properties with geography values
        for await (const prop of geoProps){
            if(allPropertyInstances.length > MAPVIEWER.resourceFindLimit){
                console.warn(`${property} property aggregation limit [${MAPVIEWER.resourceFindLimit}] reached`)
                return allPropertyInstances
            }
            let geo = data[prop]?.value ?? data[prop]?.['@value'] ?? data[prop]
            if(geo === null || geo === undefined){
                continue
            }
            if(typeof geo === "string"){
                // This could be a URI.  Attempt to resolve it
                if(geo.indexOf("www.geonames.org")){
                    // Note it is likely a geonames URI like https://www.geonames.org/2761369/vienna.html
                    // Needs turned into http://api.geonames.org/getJSON?geonameId=2761369&username=cubap&lang=en if so
                    const segments = geo.split("/")
                    const num = segments[segments.length-2]
                    const orig = geo
                    const geoNamesUri = `http://api.geonames.org/getJSON?geonameId=${num}&username=cubap&lang=en`
                    geo = await fetch(geoNamesUri, {"cache":"default"})
                    .then(resp => resp.json())
                    .then(geoNamesJson => {
                        // We need to turn this into a GeoJSON object
                        // Other Event metadata to anticipate
                            // https://schema.org/image
                            // https://schema.org/url
                        if(geoNamesJson.lng && geoNamesJson.lat){
                            return {
                                "type" : "Feature",
                                "geometry":{
                                    "type" : "Point",
                                    "coordinates" : [geoNamesJson.lng, geoNamesJson.lat]
                                },
                                "properties" : {
                                    "entity_label" : entityLabel,
                                    "location_label": {
                                        "en": [
                                            `${geoNamesJson.countryName}, ${geoNamesJson.asciiName}`
                                        ]
                                    }
                                }
                            }    
                        }
                        else{
                            throw new Error(`Latitude and Longitude was missing from geonames data at '${orig}'`)
                        }
                    })
                    .catch(err => {
                        console.error(err)
                        return {}
                    })

                    // Only if we ended up with a good Point Feature??
                    MAPVIEWER.resourceMap.set(orig, geo)    
                }
                else{
                    // Just some URI that we need the JSON of.  It should result in a Feature or FeatureCollection
                    geo = await fetch(geo, {"cache":"default"})
                    .then(resp => resp.json())
                    .catch(err => {
                        console.error(err)
                        return {}
                    })
                    if(geo.id || geo["@id"]){
                        const geoid = geo.id ?? geo["@id"]
                        MAPVIEWER.resourceMap.set(geoid, geo)    
                    } 
                }
            }
            const featureType = geo.type ?? geo["@type"] ?? ""
            let data_uri = geo.id ?? geo["@id"] ?? ""
            let data_resolved
            if(featureType === "FeatureCollection"){
                if (!geo.hasOwnProperty("features")) {
                    //It is either referenced or malformed
                    geo = data_uri ? 
                        await fetch(data_uri, {"cache":"default"})
                        .then(resp => resp.json())
                        .catch(err => {
                            console.error(err)
                            return {}
                        })
                        : {}

                    if (geo.hasOwnProperty("features")) {
                        //Then this it is dereferenced and we want it moving forward.  Otherwise, it is ignored as unusable.
                        MAPVIEWER.resourceMap.set(data_uri, geo)
                        resolved_uri = geo["@id"] ?? geo.id ?? ""
                        if(data_uri !== resolved_uri){
                            //Then the id handed back a different object.  This is not good, somebody messed up their data
                            MAPVIEWER.resourceMap.set(resolved_uri, geo)
                        }  
                        geo.__fromResource = t1
                        allPropertyInstances.push(geo)
                    }
                }
            }
            else if (featureType === "Feature"){
                if (!geo.hasOwnProperty("geometry")) {
                    //It is either referenced or malformed
                    data_uri = geo.id ?? geo["@id"]
                    geo = data_uri ? 
                        await fetch(data_uri, {"cache":"default"})
                        .then(resp => resp.json())
                        .catch(err => {
                            console.error(err)
                            return {}
                        })
                        : {}

                    if (geo.hasOwnProperty("geometry")) {
                        //Then this it is dereferenced and we want it moving forward.  Otherwise, it is ignored as unusable.
                        MAPVIEWER.resourceMap.set(data_uri, data_resolved)
                        resolved_uri = data_resolved["@id"] ?? data_resolved.id ?? ""
                        if(data_uri !== resolved_uri){
                            //Then the id handed back a different object.  This is not good, somebody messed up their data
                            MAPVIEWER.resourceMap.set(resolved_uri, data_resolved)
                        }  
                    }
                }
                if(!geo.properties) geo.properties = {}
                geo.properties.__fromResource = t1
                allPropertyInstances.push(geo)
            }
        }
    }
    return allPropertyInstances
}

/**
 * Check if the resource is a Musical Map resource.  If not, the MAPVIEWER cannot process it.
 * Verify against Musical Map archtypes and the JSON-LD context.
 * For now, @context mismatches only result in a warning and the Entity is still processed.
 * 
 * @return boolean
 */
MAPVIEWER.verifyResource = function() {
    let resourceType = MAPVIEWER.resource.type ?? MAPVIEWER.resource["@type"] ?? ""
    if (MAPVIEWER.supportedTypes.includes(resourceType)) {
        //@context value is a string.
        if(!MAPVIEWER.resource["@context"]){
            console.warn("The resource provided does not have a linked data context.  The resource will be processed, but please fix this ASAP.")
            //alert("The resource provided does not have a linked data context.  The resource will be processed, but please fix this ASAP.")
        }
        else if (typeof MAPVIEWER.resource["@context"] === "string") {
            if (!MAPVIEWER.musical_map_contexts.includes(MAPVIEWER.resource["@context"])) {
                console.warn("The top level object you provided does not contain the Musical Maps JSON-LD context.  Ensure this is correct for your resource.  Processing will continue.")
                //alert("The top level object you provided does not contain the Musical Maps JSON-LD context.  Ensure this is correct for your resource.  Processing will continue.")
            }
            //return false
        }
        //@context value is an array
        else if (Array.isArray(MAPVIEWER.resource["@context"]) && MAPVIEWER.resource["@context"].length > 0) {
            let includes_musical_map_context = MAPVIEWER.resource["@context"].some(context => {
                return MAPVIEWER.musical_map_contexts.includes(context)
            })
            if (!includes_musical_map_context) {
                console.warn("The resource type does not have the Musical Maps @context.")
                //alert("The resource type does not have the Musical Maps @context.")
            }
            //return includes_musical_map_context
        }
        //@context value is a custom object -- NOT SUPPORTED
        else if (MAPVIEWER.isJSON(MAPVIEWER.resource["@context"])) {
            console.warn("We cannot support custom context objects.  The resource will be processed, but please use the Musical Maps Linked Data context reference.")
            //alert("We cannot support custom context objects.  The resource will be processed, but please use the Musical Maps Linked Data context reference.")
            //return false
        }    
        return true
    } 
}


/**
 * Given the URI of a web resource, resolve it and get the GeoJSON by discovering app registered geographic properties.
 * @param {String} dataURL URI of the web resource to dereference and consume.
 * @return {Array}
 */
MAPVIEWER.consumeForGeoJSON = async function(dataURL) {
    let geoJSONFeatures = []

    let dataObj = await fetch(dataURL, {"cache":"default"})
        .then(resp => resp.json())
        .then(man => { return man })
        .catch(err => { return null })

    if (dataObj) {
        MAPVIEWER.resource = dataObj
        const entityLabel = MAPVIEWER.resource.name ?? MAPVIEWER.resource.label ?? MAPVIEWER.resource.title ?? "No Entity Label"
        dataLabel.setAttribute("deer-id", dataURL)
        if (!MAPVIEWER.verifyResource()) {
            //We cannot reliably parse the features from this resource.  Return the empty array.
            return geoJSONFeatures
        }
        // TODO we need to get all the events this id is presentAt.  Each of those is an Event with location.
        const query = {
            "target" : MAPVIEWER.httpsIdArray(dataURL),
            "body.presentAt" : {$exists:true},
            "__rerum.history.next":{ $exists: true, $eq: [] }
        }

        let entityEvents = await fetch("https://tinydev.rerum.io/app/query?limit=100&skip=0", {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8"
            },
            body: JSON.stringify(query)
        })
        .then(r => r.json())
        .then(pointers => {
            let list = []
            pointers.forEach(pa => {
                // presentAt can be a String URI or an Array of String URIs, or null/undefined
                if(!pa.body?.presentAt?.value) { return }
                const paVal = pa.body.presentAt.value
                if (paVal.date) {
                    list.push(Promise.resolve(paVal))
                    return
                }
                try {
                    const uri = new URL(paVal['@id'] ?? paVal.id ?? paVal)
                    list.push(fetch(uri.href).then(r=>r.json()))
                } catch(err){
                    console.warn(err)
                }
            })
            return Promise.all(list)    
        })
        .catch(err => {
            console.warn("There was an error looking for Events this entity was present at");
            console.warn(err)
            return []
        })
        // duplicate and modify range events
        let sortableEvents = entityEvents.flatMap(item=>{
            if(item.startDate) {
                item.date = item.startDate
            }
            if(item.endDate) {
                return [ item, Object.assign({...item}, {date:item.endDate})  ]
            }
            return item
        })

        // Sort the events by date
        entityEvents = sortableEvents.toSorted(function(a,b){return new Date(a.date) - new Date(b.date)})

        // Make a flat array of all GeoJSON Features from the event.
        for await (const event of entityEvents){
            const geo = await MAPVIEWER.findAllFeatures(event, MAPVIEWER.possibleGeoProperties)
            geoJSONFeatures = geoJSONFeatures.concat(geo)   
        }
        geoJSONFeatures = geoJSONFeatures.reduce((prev, curr) => {
            //Referenced values were already resolved at this point.  If there are no features, there are no features :(
            // For FeatureCollections, make sure its Features know what kind of resource they came from.
            if (curr.features) {
                //The Feature Collection knows what resource it came from.  Make all of its Features know too.
                if(curr.__fromResource){
                    curr.features.forEach(f => {
                        f.properties.__fromResource = curr.__fromResource ?? ""
                    })    
                }
                return prev.concat(curr.features)
            }
            return prev.concat(curr)
        }, [])
        //These are all points in order of time.  Make a Line out of them.
        let lineStringFeature = {
            "type" : "Feature",
            "geometry":{
                "type" : "LineString",
                "coordinates" : []
            },
            "properties" : {
                "__fromResource" : MAPVIEWER.resource.type ?? MAPVIEWER.resource["@type"] ?? ""
            }
        }
        geoJSONFeatures.forEach(f => {
            lineStringFeature.geometry.coordinates.push(f.geometry.coordinates)
        })
        geoJSONFeatures.push(lineStringFeature)
        return geoJSONFeatures
    } 
    else {
        alert("Provided URI did not resolve and so was not dereferencable.  There is no data.")
        return geoJSONFeatures
    }
}

/**
 * Initialize the application.
 */
MAPVIEWER.init = async function() {
    MAPVIEWER.supportedTypes = Array.from(MAPVIEWER.musicalMapTypes)
    let latlong = [12, 12] //default starting coords
    let geos = []
    let resource = {}
    let geoJsonData = []
    let dataInURL = MAPVIEWER.getURLParameter("data")
    if (dataInURL) {
        needs.classList.add("is-hidden")
        loadInput.classList.add("is-hidden")
        viewerBody.classList.remove("is-hidden")
        reset.classList.remove("is-hidden")
        geoJsonData = await MAPVIEWER.consumeForGeoJSON(dataInURL)
            .then(geoMarkers => { return geoMarkers })
            .catch(err => {
                console.error(err)
                return []
            })
    }
    let formattedGeoJsonData = geoJsonData.flat(1) //AnnotationPages and FeatureCollections cause arrays in arrays.  
    //Abstracted.  Maybe one day you want to MAPVIEWER.initializeOtherWebMap(latlong, allGeos)
    MAPVIEWER.initializeLeaflet(latlong, formattedGeoJsonData)
}

/**
 * Inititalize a Leaflet Web Map with a standard base map. Give it GeoJSON to draw.
 * 
 * @param coords A long,lat coordinate array for what geography the viewer should start centralized on
 * @param geoMarkers A flat array of GeoJSON FeatureCollection and Feature objects to draw.
 */
MAPVIEWER.initializeLeaflet = async function(coords, geoMarkers) {
    
    let mapbox_satellite_layer=
    L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoidGhlaGFiZXMiLCJhIjoiY2pyaTdmNGUzMzQwdDQzcGRwd21ieHF3NCJ9.SSflgKbI8tLQOo2DuzEgRQ', {
        maxZoom: 19,
        id: 'mapbox.satellite', //mapbox.streets
        accessToken: 'pk.eyJ1IjoidGhlaGFiZXMiLCJhIjoiY2pyaTdmNGUzMzQwdDQzcGRwd21ieHF3NCJ9.SSflgKbI8tLQOo2DuzEgRQ'
    })

    let osm = 
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    })

    let esri_street = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19
    })
    let esri_natgeo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19
    })

    let topomap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    })

    let carto = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    })

    let USGS_top_streets = L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19
    })

    MAPVIEWER.mymap = L.map('leafletInstanceContainer', {
        center: coords,
        zoom: 2,
        layers: [esri_street]
    })

    let baseMaps = {
        "OpenStreetMap": osm,
        "CartoDB": carto,
        "ESRI Street" : esri_street,
        "ESRI NatGeo" : esri_natgeo,
        "Open Topomap": topomap,
        "USGS Topo + Street": USGS_top_streets,
        "Mapbox Satellite": mapbox_satellite_layer
    }
    let layerControl = L.control.layers(baseMaps, {}).addTo(MAPVIEWER.mymap)

    // let overlayMaps = {
    //     "Cities": osm,
    //     "Streets": esri_street,
    //     "Satellite" : mapbox_satellite_layer,
    //     "Topography" : topomap
    // };
    //var layerControl = L.control.layers(baseMaps, overlayMaps).addTo(MAPVIEWER.mymap)

    let appColor = "#008080"
    L.geoJSON(geoMarkers, {
            pointToLayer: function(feature, latlng) {
                let __fromResource = feature.properties.__fromResource ?? ""
                appColor = "purple"
                // switch (__fromResource) {
                //     case "Person":
                //         appColor = "blue"
                //         break
                //     case "Place":
                //         appColor = "purple"
                //         break
                //     case "Thing":
                //         appColor = "yellow"
                //         break
                //     case "Event":
                //         appColor = "#008080"
                //         break
                //     default:
                //         appColor = "red"
                // }
                return L.circleMarker(latlng, {
                    radius: 6,
                    fillColor: appColor,
                    color: appColor,
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 1                })
            },
            style: function(feature) {
                let __fromResource = feature.properties.__fromResource ?? ""
                appColor = "purple"
                // switch (__fromResource) {
                //     case "Person":
                //         appColor = "blue"
                //         break
                //     case "Place":
                //         appColor = "purple"
                //         break
                //     case "Thing":
                //         appColor = "yellow"
                //         break
                //     case "Event":
                //         appColor = "#008080"
                //         break
                //     default:
                //         appColor = "red"
                // }
                const ft = feature.geometry.type ?? feature.geometry["@type"] ?? ""
                if (ft !== "Point") {
                    let options = {
                        color: appColor,
                        fillColor: appColor,
                        opacity: 0.25,
                        fillOpacity: 0.25,
                        interactive: false
                    }
                    if(ft === "LineString"){
                        // Make these dashed to imply 'travel'
                        options.dashArray = 4
                    }
                    return options
                }
            },
            onEachFeature: MAPVIEWER.formatPopup
        })
        .addTo(MAPVIEWER.mymap)
    leafletInstanceContainer.style.backgroundImage = "none"
    loadingMessage.classList.add("is-hidden")
}

/**
 * Define what information from each Feature belongs in the popup
 * that appears.  We want to show labels, summaries and thumbnails.
 */
MAPVIEWER.formatPopup = function(feature, layer) {
    let popupContent = ""
    let i = 0
    let langs = []
    let stringToLangMap = {"none":[]}
    if (feature.properties){
        if (feature.properties.entity_label) {
            popupContent += `<div class="featureInfo"> ${feature.properties.entity_label} </div>`
        }
        if (feature.properties.location_label){
            //This should be a language map, but might be a string...
            if(typeof feature.properties.location_label === "string"){
                //console.warn("Detected a 'label' property with a string value.  'label' must be a language map.")
                stringToLangMap.none.push(feature.properties.location_label)
                feature.properties.location_label = JSON.parse(JSON.stringify(stringToLangMap))
            }
            langs = Object.keys(feature.properties.location_label)
            if(langs.length > 0){
                popupContent += `<div class="featureInfo">`
                //Brute force loop all the languages and add them together, separated by their language keys.
                for (const langKey in feature.properties.location_label) {
                    let allLabelsForLang =
                        feature.properties.location_label[langKey].length > 1 ? feature.properties.location_label[langKey].join(" -- ") :
                        feature.properties.location_label[langKey]
                    popupContent += `<b>${langKey}: ${allLabelsForLang}</b></br>`
                    if(langs.length > 1 && i<langs.length-1){
                        popupContent += `</br>`
                    }
                    i++
                }
                popupContent += `</div>`    
            }
        }   
        layer.bindPopup(popupContent)
    }
}

MAPVIEWER.getURLParameter = function(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        if (pair[0] == variable) { return pair[1]; }
    }
    return (false);
}

MAPVIEWER.httpsIdArray = function (id,justArray) {
    if (!id.startsWith("http")) return justArray ? [ id ] : id
    if (id.startsWith("https://")) return justArray ? [ id, id.replace('https','http') ] : { $in: [ id, id.replace('https','http') ] }
    return justArray ? [ id, id.replace('http','https') ] : { $in: [ id, id.replace('http','https') ] }
}

MAPVIEWER.init()
