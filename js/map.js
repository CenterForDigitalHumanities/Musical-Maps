/* 
 * @author Bryan Haberberger
 * https://github.com/thehabes 
 */

let VIEWER = {}

//Keep tracked of fetched resources.  Do not fetch resources you have already resolved.
VIEWER.resourceMap = new Map()

//Keep track of how many resources you have fetched
VIEWER.resourceFetchCount = 0

//Keep track of how many resources you are processing for navPlace
VIEWER.resourceCount = 0

//Once you have fetched this many resources, fetch no more.  Helps stop infinite loops from circular references.
VIEWER.resourceFetchLimit = 1000

//Once you have processed this many resources, process no more.  Helps stop infinite loops from circular references.
VIEWER.resourceFindLimit = 1000

//The resource supplied via the iiif-content paramater.  All referenced values that could be resolved are resolved and embedded.
VIEWER.resource = {}

//For Leaflet
VIEWER.mymap = {}

//Supported Resource Types
VIEWER.musicalMapTypes = ["Person", "Place", "Thing"]

//Supported Resource Types
VIEWER.possibleGeoProperties = ["birthPlace", "location"]

//Viewer specific resources to consider in logic.  Set on init()
VIEWER.supportedTypes = []

//Properties to look into for more geography.
VIEWER.recurseKeys = ["items"]

//We only support IIIF resource types with IIIF Presentation API contexts.
VIEWER.musical_map_contexts = ["https://musicalmaps.rerum.io/context.json", "http://musicalmaps.rerum.io/context.json"]

//GeoJSON contexts to verify
VIEWER.geojson_contexts = ["https://geojson.org/geojson-ld/geojson-context.jsonld", "http://geojson.org/geojson-ld/geojson-context.jsonld"]

VIEWER.isJSON = function(obj) {
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
 * Get and combine the GeoJSON from the provided geoProps.  Properties not listed in geoProps are ignored.
 * If you come across a referenced value, attempt to dereference it.  If successful, embed it to go forward with (so as not to resolve it again)
 * 
 * Return the array of Feature Collections and/or Features
 */
VIEWER.findAllFeatures = async function(expandedEntities, geoProps, allPropertyInstances = [], setResource = true) {
    //Check against the limits first.  If we reached any, break the recursion and return the results so far.
    if(VIEWER.resourceCount > VIEWER.resourceFindLimit){
        console.warn(`Resource processing limit [${VIEWER.resourceFindLimit}] reached. Make sure your resources do not contain circular references.`)
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
        VIEWER.resourceCount += 1
        if(VIEWER.resourceCount > VIEWER.resourceFindLimit){
            console.warn(`geography lookup limit [${VIEWER.resourceFindLimit}] reached`)
            return allPropertyInstances
        }
        if (VIEWER.supportedTypes.includes(t1)) {
            //Loop the keys, looks for those properties with geography values
            for await (const prop of geoProps){
                if(allPropertyInstances.length > VIEWER.resourceFindLimit){
                    console.warn(`${property} property aggregation limit [${VIEWER.resourceFindLimit}] reached`)
                    return allPropertyInstances
                }
                let geo = data[prop]
                if(geo === null || geo === undefined){
                    geo = {}
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
                                        },
                                        "seeAlso" : orig,
                                    }
                                }    
                            }
                            else{
                                return {}
                            }
                        })
                        .catch(err => {
                            console.error(err)
                            return {}
                        })

                        // Only if we ended up with a good Point Feature??
                        VIEWER.resourceMap.set(orig, geo)    
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
                            VIEWER.resourceMap.set(geoid, geo)    
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
                            VIEWER.resourceMap.set(data_uri, geo)
                            resolved_uri = geo["@id"] ?? geo.id ?? "Yikes"
                            if(data_uri !== resolved_uri){
                                //Then the id handed back a different object.  This is not good, somebody messed up their data
                                VIEWER.resourceMap.set(resolved_uri, geo)
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
                            VIEWER.resourceMap.set(data_uri, data_resolved)
                            resolved_uri = data_resolved["@id"] ?? data_resolved.id ?? "Yikes"
                            if(data_uri !== resolved_uri){
                                //Then the id handed back a different object.  This is not good, somebody messed up their data
                                VIEWER.resourceMap.set(resolved_uri, data_resolved)
                            }  
                        }
                    }
                    if(!geo.properties) geo.properties = {}
                    geo.properties.__fromResource = t1
                    //Essentially, this is our base case.  We have the geography object and do not need to recurse.  We just continue looping the keys.
                    allPropertyInstances.push(geo)
                }
            }
        }
    }

    return allPropertyInstances
}

/**
 * For supplying latitude/longitude values via the coordinate number inputs.
 * Position the Leaflet map and update the diplayed coordinate text.
 * Note that order matters, so we are specifically saying what is Lat and what is Long.
 */
VIEWER.updateGeometry = function(event) {
    event.preventDefault()
    let lat = clickedLat ? clickedLat : leafLat.value
    lat = parseInt(lat * 1000000) / 1000000
    let long = clickedLong ? clickedLong : leafLong.value
    long = parseInt(long * 1000000) / 1000000
    if (lat && long) {
        VIEWER.mymap.setView([lat, long], 16)
        let coords = `lat: ${leafLat.value}, lon: ${leafLong.value}`
        document.getElementById("currentCoords").innerHTML = `[${coords}]`
    }
    leafLat.value = lat
    leafLong.value = long
}

/**
 * Check if the resource is IIIF Presentation API 3.  If not, the viewer cannot process it.
 * We will also check for the navPlace context...but we will only warn the user if it isn't there.
 */
VIEWER.verifyResource = function() {
    let resourceType = VIEWER.resource.type ?? VIEWER.resource["@type"] ?? "Yikes"
    if (VIEWER.supportedTypes.includes(resourceType)) {
        //Verification for IIIF Presentation API Defined Types
        //@context value is a string.
        if(!VIEWER.resource["@context"]){
            alert("The resource provided does not have a linked data context.  The resource will be processed, but please fix this ASAP.")
        }
        else if (typeof VIEWER.resource["@context"] === "string") {
            if (!VIEWER.musical_map_contexts.includes(VIEWER.resource["@context"])) {
                alert("The top level object you provided does not contain the Musical Maps JSON-LD context.  Ensure this is correct for your resource.  Processing will continue.")
            }
            //return false
        }
        //@context value is an array, one item in the array needs to be one of the supported presentation api uris.  
        else if (Array.isArray(VIEWER.resource["@context"]) && VIEWER.resource["@context"].length > 0) {
            let includes_musical_map_context = VIEWER.resource["@context"].some(context => {
                return VIEWER.musical_map_contexts.includes(context)
            })
            if (!includes_musical_map_context) {
                alert("The resource type does not have the Musical Maps @context.")
            }
            //return includes_musical_map_context
        }
        //@context value is a custom object -- NOT SUPPORTED
        else if (VIEWER.isJSON(VIEWER.resource["@context"])) {
            alert("We cannot support custom context objects.  The resource will be processed, but please use the Musical Maps Linked Data context reference.")
            //return false
        }    
        return true
    } 
}


/**
 * Given the URI of a web resource, resolve it and get the GeoJSON by discovering navPlace properties.
 * @param {type} URI of the web resource to dereference and consume.
 * @return {Array}
 */
VIEWER.consumeForGeoJSON = async function(dataURL) {
    let geoJSONFeatures = []

    let dataObj = await fetch(dataURL, {"cache":"default"})
        .then(resp => resp.json())
        .then(man => { return man })
        .catch(err => { return null })

    if (dataObj) {
        VIEWER.resource = JSON.parse(JSON.stringify(dataObj))
        if (!VIEWER.verifyResource()) {
            //We cannot reliably parse the features from this resource.  Return the empty array.
            return geoJSONFeatures
        }
        geoJSONFeatures = await VIEWER.findAllFeatures(VIEWER.resource, VIEWER.possibleGeoProperties)
        geoJSONFeatures = geoJSONFeatures.reduce((prev, curr) => {
            //Referenced values were already resolved at this point.  If there are no features, there are no features :(
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
        return geoJSONFeatures
    } else {
        alert("Provided URI did not resolve and so was not dereferencable.  There is no data.")
        return geoJSONFeatures
    }
}

/**
 * Initialize the application.
 * @param {type} view
 * @return {undefined}
 */
VIEWER.init = async function() {
    VIEWER.resourceTypes
    // Don't let either viewer be a catch all for all types.
    if(location.pathname.includes("annotation-viewer")) VIEWER.supportedTypes = Array.from(VIEWER.annotationTypes)
    else{ VIEWER.supportedTypes = Array.from(VIEWER.musicalMapTypes) }

    let latlong = [12, 12] //default starting coords
    let geos = []
    let resource = {}
    let geoJsonData = []
    let dataInURL = VIEWER.getURLParameter("data")
    if (dataInURL) {
        needs.classList.add("is-hidden")
        viewerBody.classList.remove("is-hidden")
        geoJsonData = await VIEWER.consumeForGeoJSON(dataInURL)
            .then(geoMarkers => { return geoMarkers })
            .catch(err => {
                console.error(err)
                return []
            })
    }
    let formattedGeoJsonData = geoJsonData.flat(1) //AnnotationPages and FeatureCollections cause arrays in arrays.  
    //Abstracted.  Maybe one day you want to VIEWER.initializeOtherWebMap(latlong, allGeos)
    VIEWER.initializeLeaflet(latlong, formattedGeoJsonData)
}

/**
 * Inititalize a Leaflet Web Map with a standard base map. Give it GeoJSON to draw.
 * In this case, the GeoJSON are all Features take from Feature Collections.
 * These Feature Collections were values of navPlace properties or Web Annotation bodies.
 * All Features from the outer most objects and their children are present.
 * This may have caused duplicates in some cases.
 */
VIEWER.initializeLeaflet = async function(coords, geoMarkers) {
    
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

    VIEWER.mymap = L.map('leafletInstanceContainer', {
        center: coords,
        zoom: 2,
        layers: [osm, esri_street, topomap, mapbox_satellite_layer]
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
    let layerControl = L.control.layers(baseMaps, {}).addTo(VIEWER.mymap)

    // let overlayMaps = {
    //     "Cities": osm,
    //     "Streets": esri_street,
    //     "Satellite" : mapbox_satellite_layer,
    //     "Topography" : topomap
    // };
    //var layerControl = L.control.layers(baseMaps, overlayMaps).addTo(VIEWER.mymap)

    let appColor = "#008080"
    L.geoJSON(geoMarkers, {
            pointToLayer: function(feature, latlng) {
                let __fromResource = feature.properties.__fromResource ?? ""
                switch (__fromResource) {
                    case "Person":
                        appColor = "blue"
                        break
                    case "Place":
                        appColor = "purple"
                        break
                    case "Thing":
                        appColor = "yellow"
                        break
                    case "Event":
                        appColor = "#008080"
                        break
                    default:
                        appColor = "red"
                }
                return L.circleMarker(latlng, {
                    radius: 6,
                    fillColor: appColor,
                    color: appColor,
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 1
                })
            },
            style: function(feature) {
                let __fromResource = feature.properties.__fromResource ?? ""
                switch (__fromResource) {
                    case "Person":
                        appColor = "blue"
                        break
                    case "Place":
                        appColor = "purple"
                        break
                    case "Thing":
                        appColor = "yellow"
                        break
                    case "Event":
                        appColor = "#008080"
                        break
                    default:
                        appColor = "red"
                }
                const ft = feature.geometry.type ?? feature.geometry["@type"] ?? ""
                if (ft !== "Point") {
                    return {
                        color: appColor,
                        fillColor: appColor,
                        fillOpacity: 0.09
                    }
                }
            },
            onEachFeature: VIEWER.formatPopup
        })
        .addTo(VIEWER.mymap)
    leafletInstanceContainer.style.backgroundImage = "none"
    loadingMessage.classList.add("is-hidden")
}

/**
 * Define what information from each Feature belongs in the popup
 * that appears.  We want to show labels, summaries and thumbnails.
 */
VIEWER.formatPopup = function(feature, layer) {
    let popupContent = ""
    let i = 0
    let langs = []
    let stringToLangMap = {"none":[]}
    if (feature.properties){
        if (feature.properties.entity_label) {
            popupContent += `<div class="featureInfo"> ${feature.properties.entity_label} </div>`
        }
        // if (feature.properties.location_label){
        //     //This should be a language map, but might be a string...
        //     if(typeof feature.properties.location_label === "string"){
        //         //console.warn("Detected a 'label' property with a string value.  'label' must be a language map.")
        //         stringToLangMap.none.push(feature.properties.location_label)
        //         feature.properties.location_label = JSON.parse(JSON.stringify(stringToLangMap))
        //     }
        //     langs = Object.keys(feature.properties.location_label)
        //     if(langs.length > 0){
        //         popupContent += `<div class="featureInfo">`
        //         //Brute force loop all the languages and add them together, separated by their language keys.
        //         for (const langKey in feature.properties.location_label) {
        //             let allLabelsForLang =
        //                 feature.properties.location_label[langKey].length > 1 ? feature.properties.location_label[langKey].join(" -- ") :
        //                 feature.properties.location_label[langKey]
        //             popupContent += `<b>${langKey}: ${allLabelsForLang}</b></br>`
        //             if(langs.length > 1 && i<langs.length-1){
        //                 popupContent += `</br>`
        //             }
        //             i++
        //         }
        //         popupContent += `</div>`    
        //     }
        // }
        if (feature.properties.summary) {
            stringToLangMap = {"none":[]}
            i = 0
            if(typeof feature.properties.summary === "string"){
                //console.warn("Detected a 'summary' property with a string value.  'summary' must be a language map.")
                stringToLangMap.none.push(feature.properties.summary)
                feature.properties.summary = JSON.parse(JSON.stringify(stringToLangMap))
            }
            langs = Object.keys(feature.properties.summary)
            if(langs.length > 0){
                popupContent += `<div class="featureInfo">`
                //Brute force loop all the languages and add them together, separated by their language keys.
                for (const langKey in feature.properties.summary) {
                    let allSummariesForLang =
                        feature.properties.summary[langKey].length > 1 ? feature.properties.summary[langKey].join(" -- ") :
                        feature.properties.summary[langKey]
                    popupContent += `<b>${langKey}: ${allSummariesForLang}</b></br>`
                    if(langs.length > 1 && i<langs.length-1){
                        popupContent += `</br>`
                    }
                    i++
                }
                popupContent += `</div>`
            }
        }
        if (feature.properties.thumbnail) {
            let thumbnail = feature.properties.thumbnail[0].id ?? feature.properties.thumbnail[0]["@id"] ?? ""
            popupContent += `<img src="${thumbnail}"\></br>`
        }
        if (feature.properties.seeAlso) {
            let seeURI = feature.properties.seeAlso ?? ""
            popupContent += `See <a href="${feature.properties.seeAlso}" target="_blank">${feature.properties.seeAlso}</a>`
        }
        
        layer.bindPopup(popupContent)
    }
}

VIEWER.getURLParameter = function(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        if (pair[0] == variable) { return pair[1]; }
    }
    return (false);
}

VIEWER.init()
