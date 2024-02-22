import window from 'global/window';
import Playlist from './playlist';
import { codecsForPlaylist } from './util/codecs.js';
import logger from './util/logger';
import { timeUntilRebuffer } from './ranges.js';
import config from './config';

const logFn = logger('PlaylistSelector');
const representationToString = function(representation) {
  if (!representation || !representation.playlist) {
    return;
  }
  const playlist = representation.playlist;

  return JSON.stringify({
    id: playlist.id,
    bandwidth: representation.bandwidth,
    width: representation.width,
    height: representation.height,
    codecs: playlist.attributes && playlist.attributes.CODECS || ''
  });
};

// Utilities

/**
 * Returns the CSS value for the specified property on an element
 * using `getComputedStyle`. Firefox has a long-standing issue where
 * getComputedStyle() may return null when running in an iframe with
 * `display: none`.
 *
 * @see https://bugzilla.mozilla.org/show_bug.cgi?id=548397
 * @param {HTMLElement} el the htmlelement to work on
 * @param {string} the proprety to get the style for
 */
const safeGetComputedStyle = function(el, property) {
  if (!el) {
    return '';
  }

  const result = window.getComputedStyle(el);

  if (!result) {
    return '';
  }

  return result[property];
};

/**
 * Resuable stable sort function
 *
 * @param {Playlists} array
 * @param {Function} sortFn Different comparators
 * @function stableSort
 */
const stableSort = function(array, sortFn) {
  const newArray = array.slice();

  array.sort(function(left, right) {
    const cmp = sortFn(left, right);

    if (cmp === 0) {
      return newArray.indexOf(left) - newArray.indexOf(right);
    }
    return cmp;
  });
};

/**
 * A comparator function to sort two playlist object by bandwidth.
 *
 * @param {Object} left a media playlist object
 * @param {Object} right a media playlist object
 * @return {number} Greater than zero if the bandwidth attribute of
 * left is greater than the corresponding attribute of right. Less
 * than zero if the bandwidth of right is greater than left and
 * exactly zero if the two are equal.
 */
export const comparePlaylistBandwidth = function(left, right) {
  let leftBandwidth;
  let rightBandwidth;

  if (left.attributes.BANDWIDTH) {
    leftBandwidth = left.attributes.BANDWIDTH;
  }
  leftBandwidth = leftBandwidth || window.Number.MAX_VALUE;
  if (right.attributes.BANDWIDTH) {
    rightBandwidth = right.attributes.BANDWIDTH;
  }
  rightBandwidth = rightBandwidth || window.Number.MAX_VALUE;

  return leftBandwidth - rightBandwidth;
};

/**
 * A comparator function to sort two playlist object by resolution (width).
 *
 * @param {Object} left a media playlist object
 * @param {Object} right a media playlist object
 * @return {number} Greater than zero if the resolution.width attribute of
 * left is greater than the corresponding attribute of right. Less
 * than zero if the resolution.width of right is greater than left and
 * exactly zero if the two are equal.
 */
export const comparePlaylistResolution = function(left, right) {
  let leftWidth;
  let rightWidth;

  if (left.attributes.RESOLUTION &&
      left.attributes.RESOLUTION.width) {
    leftWidth = left.attributes.RESOLUTION.width;
  }

  leftWidth = leftWidth || window.Number.MAX_VALUE;

  if (right.attributes.RESOLUTION &&
      right.attributes.RESOLUTION.width) {
    rightWidth = right.attributes.RESOLUTION.width;
  }

  rightWidth = rightWidth || window.Number.MAX_VALUE;

  // NOTE - Fallback to bandwidth sort as appropriate in cases where multiple renditions
  // have the same media dimensions/ resolution
  if (leftWidth === rightWidth &&
      left.attributes.BANDWIDTH &&
      right.attributes.BANDWIDTH) {
    return left.attributes.BANDWIDTH - right.attributes.BANDWIDTH;
  }
  return leftWidth - rightWidth;
};

/**
 * Chooses the appropriate media playlist based on bandwidth and player size
 *
 * @param {Object} main
 *        Object representation of the main manifest
 * @param {number} playerBandwidth
 *        Current calculated bandwidth of the player
 * @param {number} playerWidth
 *        Current width of the player element (should account for the device pixel ratio)
 * @param {number} playerHeight
 *        Current height of the player element (should account for the device pixel ratio)
 * @param {boolean} limitRenditionByPlayerDimensions
 *        True if the player width and height should be used during the selection, false otherwise
 * @param {Object} playlistController
 *        the current playlistController object
 * @return {Playlist} the highest bitrate playlist less than the
 * currently detected bandwidth, accounting for some amount of
 * bandwidth variance
 */
export let simpleSelector = function(
  main,
  playerBandwidth,
  playerWidth,
  playerHeight,
  limitRenditionByPlayerDimensions,
  playlistController,
  bufferedSeconds
) {

  // If we end up getting called before `main` is available, exit early
  if (!main) {
    return;
  }

  const options = {
    bandwidth: playerBandwidth,
    width: playerWidth,
    height: playerHeight,
    limitRenditionByPlayerDimensions
  };

  let playlists = main.playlists;

  // if playlist is audio only, select between currently active audio group playlists.
  if (Playlist.isAudioOnly(main)) {
    playlists = playlistController.getAudioTrackPlaylists_();
    // add audioOnly to options so that we log audioOnly: true
    // at the buttom of this function for debugging.
    options.audioOnly = true;
  }
  // convert the playlists to an intermediary representation to make comparisons easier
  let sortedPlaylistReps = playlists.map((playlist) => {
    let bandwidth;
    const width = playlist.attributes && playlist.attributes.RESOLUTION && playlist.attributes.RESOLUTION.width;
    const height = playlist.attributes && playlist.attributes.RESOLUTION && playlist.attributes.RESOLUTION.height;

    bandwidth = playlist.attributes && playlist.attributes.BANDWIDTH;

    bandwidth = bandwidth || window.Number.MAX_VALUE;

    return {
      bandwidth,
      width,
      height,
      playlist
    };
  });

  stableSort(sortedPlaylistReps, (left, right) => left.bandwidth - right.bandwidth);

  // filter out any playlists that have been excluded due to
  // incompatible configurations
    sortedPlaylistReps = sortedPlaylistReps.filter((rep) => !Playlist.isIncompatible(rep.playlist));

    // filter out any playlists that have been disabled manually through the representations
    // api or excluded temporarily due to playback errors.
    let enabledPlaylistReps = sortedPlaylistReps.filter((rep) => Playlist.isEnabled(rep.playlist));

    if (!enabledPlaylistReps.length) {
      // if there are no enabled playlists, then they have all been excluded or disabled
      // by the user through the representations api. In this case, ignore exclusion and
      // fallback to what the user wants by using playlists the user has not disabled.
      enabledPlaylistReps = sortedPlaylistReps.filter((rep) => !Playlist.isDisabled(rep.playlist));
    }

    let intError = 0;
    let tLast = -1;
    let bweFilt = -1;
    let den; let u;
    const horizon = 3;
    let bweVec = [];
    let maxLevelImp = 0;
    let minLevelImp = 0;
    let qH = config.BUFFER_LOW_WATER_LINE;  //da risolvere
    let qL = config.BUFFER_HIGH_WATER_LINE; //da risolvere
    const qLL = qL * 0.8; // minimum queue length before apply the controller action
    let coldStart = true;
    let zeroIntError;
    let lastLevel = 0;
    let levelU = 0;
    let levelE = 0;
    let manualLevel = false;
    let precState = 0; // 0 below qL, 1 inside deadzone, 2 above qH
      
    // Creo una copia dell'array main.playlists
    const sortedPlaylists = main.playlists.slice();
      
    // Ordino la copia in base alla proprietà BANDWIDTH
    sortedPlaylists.sort((a, b) => a.attributes.BANDWIDTH - b.attributes.BANDWIDTH);
    
    const enabledPlaylists = sortedPlaylists.filter(playlist => Playlist.isEnabled(playlist));
    const enabledPlaylistIds = enabledPlaylists.map(playlist => playlist.id);

    function _onFragment(queueTime, isPlaying, curBitrate) {
      
      // Ora il primo elemento ha il valore minimo e l'ultimo elemento ha il valore massimo
      const maxBitrate = sortedPlaylists[sortedPlaylists.length - 1].attributes.BANDWIDTH;
      const minBitrate = sortedPlaylists[0].attributes.BANDWIDTH;

      if (curBitrate >= 2 * maxBitrate) {
        bweVec.push(2 * maxBitrate);
      } else {
        bweVec.push(curBitrate);
      }
      bweVec = bweVec.slice(-horizon);

      bweFilt = bweVec.length / bweVec.reduce((sum, v) => sum + (1.0 / v), 0);

      queueTime = Math.abs(queueTime);

      let e = 0;

      if (queueTime > qH) {
        zeroIntError = (precState === 0);
        precState = 2;
        e = queueTime - qH;
      } else if (queueTime < qL) {
        zeroIntError = (precState === 2);
        precState = 0;
        e = queueTime - qL;
      } else {
        precState = 1;
        zeroIntError = true;
      }

      let deltaTime;
      const d = (isPlaying ? 1 : 0);

      
      if (tLast < 0) {
        deltaTime = 0;
        intError = e;
      } else {
        const ts = new Date().getTime();

        deltaTime = (ts - tLast) / 1000;
        if (zeroIntError) {
          intError = 0;
        }
        intError += deltaTime * e; 
      }
      tLast = new Date().getTime();

      let k1 = 1/100;
      let k2 = 1/1000;

      den = 1.0 - (k1 * e) - (k2 * intError);

      if (queueTime < qL || queueTime > qH) {
        if (queueTime < qLL && coldStart) {
          den = 1.2;
          resetIntegralError(deltaTime * e);
        } else if (coldStart) {
          coldStart = false;
        }

        if (den <= 0 || (bweFilt / den) >= maxBitrate) {
          u = maxBitrate + 10;
          resetIntegralError(deltaTime * e);
        } else if ((bweFilt / den) <= minBitrate) {
          u = minBitrate;
          resetIntegralError(deltaTime * e);
        } else {
          u = bweFilt / den;
        }

        levelU = quantizeRate(u, main);

        // Check se il livello è abilitato o disabilitato momentaneamente a causa di un errore del player
        if (enabledPlaylistIds.includes(levelU)) {
          levelE = levelU;
        } else {
          let foundLowerLevel = false;
          for (let i = enabledPlaylistIds.indexOf(levelU) - 1; i >= 0; i--) {
            if (enabledPlaylistIds.includes(enabledPlaylistIds[i])) {
              levelE = enabledPlaylistIds[i];
              foundLowerLevel = true;
              break;
            }
          }
          if (!foundLowerLevel) {
            // Se nessun livello inferiore è disponibile, scegliamo il primo livello abilitato
            levelE = enabledPlaylistIds[0];
          }
        }

        if (queueTime > qH && levelE < lastLevel) {
          levelE = lastLevel;
        } else {
          lastLevel = levelE;
        }
      } else {
        levelE = lastLevel;
      }
  return levelE;
}

    function resetIntegralError(data) {
      if (zeroIntError) {
        intError -= data;
      }
    }

    function quantizeRate(rate, main) {
      if (!main) {
        return;
      }
    
      let playlists = main.playlists;
    
      let sortedPlaylistReps = playlists.map((playlist) => {
        let bandwidth = playlist.attributes && playlist.attributes.BANDWIDTH;
        bandwidth = bandwidth || Number.MAX_VALUE;
    
        return {
          bandwidth,
          playlist
        };
      });
    
      sortedPlaylistReps.sort((left, right) => left.bandwidth - right.bandwidth);
    
      let chosenPlaylist = null;
    
      for (let i = 0; i < sortedPlaylistReps.length; i++) {
        if (rate >= sortedPlaylistReps[i].bandwidth) {
          chosenPlaylist = sortedPlaylistReps[i].playlist;
        } else {
          break;
        }
      }
    
      return chosenPlaylist ? chosenPlaylist.id : null;
    }

    const curBitrate = playerBandwidth; // Utilizziamo la larghezza di banda del player come curBitrate
    const queueTime = bufferedSeconds;
    const isPlaying = 1; //non utilizzato nel denominatore

    const level = _onFragment(queueTime, isPlaying, curBitrate);

    let elasticBestRep;

    let elasticBestRepResolution;

    if (level !== false) {
      elasticBestRep = main.playlists.find(playlist => playlist.id.includes(level.toString()));
      
      // Troviamo tutte le risoluzioni che soddisfano i criteri
      const matchingResolutions = sortedPlaylistReps.filter(rep => {
          return rep.bandwidth <= elasticBestRep.attributes.BANDWIDTH && rep.width <= playerWidth || rep.height <= playerHeight;
      });
  
      // Ordininiamo le risoluzioni in base alla differenza di larghezza di banda
      matchingResolutions.sort((a, b) => {
          return Math.abs(a.bandwidth - elasticBestRep.attributes.BANDWIDTH) - Math.abs(b.bandwidth - elasticBestRep.attributes.BANDWIDTH);
      });
  
      // Selezioniamo il primo elemento dall'array ordinato
      elasticBestRepResolution = matchingResolutions[0];
  };

  let elasticBestRepResolutionPlaylist = elasticBestRepResolution.playlist;

    // if we're not going to limit renditions by player size, make an early decision.
    if (limitRenditionByPlayerDimensions === false) {
      const chosenRep = (
        elasticBestRep ||
        enabledPlaylistReps[0] ||
        sortedPlaylistReps[0]
      );
      
      if (chosenRep) {
        let type;
  
        if (chosenRep === elasticBestRep) {
          type = 'elasticBestRep';
        } else if (chosenRep === enabledPlaylistReps[0]) {
          type = 'enabledPlaylistReps';
        } else if (chosenRep === sortedPlaylistReps[0]) {
          type = 'sortedPlaylistReps';
        } else {
          type = 'unknown';
        }
    
        console.log(`choosing:`, chosenRep, `using ${type} with options`, options);
        console.log(bufferedSeconds);
        if (chosenRep === elasticBestRep) {
          return chosenRep;
        } else {
          return chosenRep.playlist;
        }
      }

      console.log('could not choose a playlist with options', options);
      return null;
    }

    // fallback chain of variants
    const chosenRep = (
      elasticBestRepResolutionPlaylist ||
      elasticBestRep ||
      enabledPlaylistReps[0] ||
      sortedPlaylistReps[0]
    );
    
    if (chosenRep) {
      let type;

      if (chosenRep === elasticBestRep) {
        type = 'elasticBestRep';
      } else if (chosenRep === enabledPlaylistReps[0]) {
        type = 'enabledPlaylistReps';
      } else if (chosenRep === sortedPlaylistReps[0]) {
        type = 'sortedPlaylistReps';
      } else if (chosenRep === elasticBestRepResolutionPlaylist) {
          type = 'elasticBestRepResolutionPlaylist';
      } else {
        type = 'unknown';
      }
  
      console.log(`choosing:`, chosenRep, `using ${type} with options`, options);
      if (chosenRep === elasticBestRep || chosenRep === elasticBestRepResolutionPlaylist) {
        return chosenRep;
      } else {
        return chosenRep.playlist;
      }
    }
    console.log('could not choose a playlist with options', options);
    return null;
  };

export const TEST_ONLY_SIMPLE_SELECTOR = (newSimpleSelector) => {
  const oldSimpleSelector = simpleSelector;

  simpleSelector = newSimpleSelector;

  return function resetSimpleSelector() {
    simpleSelector = oldSimpleSelector;
  };
};

// Playlist Selectors

/**
 * Chooses the appropriate media playlist based on the most recent
 * bandwidth estimate and the player size.
 *
 * Expects to be called within the context of an instance of VhsHandler
 *
 * @return {Playlist} the highest bitrate playlist less than the
 * currently detected bandwidth, accounting for some amount of
 * bandwidth variance
 */
export const lastBandwidthSelector = function() {
  const pixelRatio = this.useDevicePixelRatio ? window.devicePixelRatio || 1 : 1;

  const buffer = this.tech_.buffered();
  const currentTime = this.tech_.currentTime();
  let maxBufferedTime = 0;
  
  for (let i = 0; i < buffer.length; i++) {
    const start = buffer.start(i);
    const end = buffer.end(i);
    if (currentTime >= start && currentTime <= end && end > maxBufferedTime) {
      maxBufferedTime = end;
    }
  }
  
  const bufferedSeconds = maxBufferedTime - currentTime;

  return simpleSelector(
    this.playlists.main,
    this.systemBandwidth,
    parseInt(safeGetComputedStyle(this.tech_.el(), 'width'), 10) * pixelRatio,
    parseInt(safeGetComputedStyle(this.tech_.el(), 'height'), 10) * pixelRatio,
    this.limitRenditionByPlayerDimensions,
    this.playlistController_,
    bufferedSeconds
  );
};

/**
 * Chooses the appropriate media playlist based on an
 * exponential-weighted moving average of the bandwidth after
 * filtering for player size.
 *
 * Expects to be called within the context of an instance of VhsHandler
 *
 * @param {number} decay - a number between 0 and 1. Higher values of
 * this parameter will cause previous bandwidth estimates to lose
 * significance more quickly.
 * @return {Function} a function which can be invoked to create a new
 * playlist selector function.
 * @see https://en.wikipedia.org/wiki/Moving_average#Exponential_moving_average
 */
export const movingAverageBandwidthSelector = function(decay) {
  let average = -1;
  let lastSystemBandwidth = -1;

  if (decay < 0 || decay > 1) {
    throw new Error('Moving average bandwidth decay must be between 0 and 1.');
  }

  return function() {
    const pixelRatio = this.useDevicePixelRatio ? window.devicePixelRatio || 1 : 1;

    if (average < 0) {
      average = this.systemBandwidth;
      lastSystemBandwidth = this.systemBandwidth;
    }

    // stop the average value from decaying for every 250ms
    // when the systemBandwidth is constant
    // and
    // stop average from setting to a very low value when the
    // systemBandwidth becomes 0 in case of chunk cancellation

    if (this.systemBandwidth > 0 && this.systemBandwidth !== lastSystemBandwidth) {
      average = decay * this.systemBandwidth + (1 - decay) * average;
      lastSystemBandwidth = this.systemBandwidth;
    }

    return simpleSelector(
      this.playlists.main,
      average,
      parseInt(safeGetComputedStyle(this.tech_.el(), 'width'), 10) * pixelRatio,
      parseInt(safeGetComputedStyle(this.tech_.el(), 'height'), 10) * pixelRatio,
      this.limitRenditionByPlayerDimensions,
      this.playlistController_
    );
  };
};

/**
 * Chooses the appropriate media playlist based on the potential to rebuffer
 *
 * @param {Object} settings
 *        Object of information required to use this selector
 * @param {Object} settings.main
 *        Object representation of the main manifest
 * @param {number} settings.currentTime
 *        The current time of the player
 * @param {number} settings.bandwidth
 *        Current measured bandwidth
 * @param {number} settings.duration
 *        Duration of the media
 * @param {number} settings.segmentDuration
 *        Segment duration to be used in round trip time calculations
 * @param {number} settings.timeUntilRebuffer
 *        Time left in seconds until the player has to rebuffer
 * @param {number} settings.currentTimeline
 *        The current timeline segments are being loaded from
 * @param {SyncController} settings.syncController
 *        SyncController for determining if we have a sync point for a given playlist
 * @return {Object|null}
 *         {Object} return.playlist
 *         The highest bandwidth playlist with the least amount of rebuffering
 *         {Number} return.rebufferingImpact
 *         The amount of time in seconds switching to this playlist will rebuffer. A
 *         negative value means that switching will cause zero rebuffering.
 */
export const minRebufferMaxBandwidthSelector = function(settings) {
  const {
    main,
    currentTime,
    bandwidth,
    duration,
    segmentDuration,
    timeUntilRebuffer,
    currentTimeline,
    syncController
  } = settings;

  // filter out any playlists that have been excluded due to
  // incompatible configurations
  const compatiblePlaylists = main.playlists.filter(playlist => !Playlist.isIncompatible(playlist));

  // filter out any playlists that have been disabled manually through the representations
  // api or excluded temporarily due to playback errors.
  let enabledPlaylists = compatiblePlaylists.filter(Playlist.isEnabled);

  if (!enabledPlaylists.length) {
    // if there are no enabled playlists, then they have all been excluded or disabled
    // by the user through the representations api. In this case, ignore exclusion and
    // fallback to what the user wants by using playlists the user has not disabled.
    enabledPlaylists = compatiblePlaylists.filter(playlist => !Playlist.isDisabled(playlist));
  }

  const bandwidthPlaylists =
    enabledPlaylists.filter(Playlist.hasAttribute.bind(null, 'BANDWIDTH'));

  const rebufferingEstimates = bandwidthPlaylists.map((playlist) => {
    const syncPoint = syncController.getSyncPoint(
      playlist,
      duration,
      currentTimeline,
      currentTime
    );
    // If there is no sync point for this playlist, switching to it will require a
    // sync request first. This will double the request time
    const numRequests = syncPoint ? 1 : 2;
    const requestTimeEstimate = Playlist.estimateSegmentRequestTime(
      segmentDuration,
      bandwidth,
      playlist
    );
    const rebufferingImpact = (requestTimeEstimate * numRequests) - timeUntilRebuffer;

    return {
      playlist,
      rebufferingImpact
    };
  });

  const noRebufferingPlaylists = rebufferingEstimates.filter((estimate) => estimate.rebufferingImpact <= 0);

  // Sort by bandwidth DESC
  stableSort(
    noRebufferingPlaylists,
    (a, b) => comparePlaylistBandwidth(b.playlist, a.playlist)
  );

  if (noRebufferingPlaylists.length) {
    return noRebufferingPlaylists[0];
  }

  stableSort(rebufferingEstimates, (a, b) => a.rebufferingImpact - b.rebufferingImpact);

  return rebufferingEstimates[0] || null;
};

/**
 * Chooses the appropriate media playlist, which in this case is the lowest bitrate
 * one with video.  If no renditions with video exist, return the lowest audio rendition.
 *
 * Expects to be called within the context of an instance of VhsHandler
 *
 * @return {Object|null}
 *         {Object} return.playlist
 *         The lowest bitrate playlist that contains a video codec.  If no such rendition
 *         exists pick the lowest audio rendition.
 */
export const lowestBitrateCompatibleVariantSelector = function() {
  // filter out any playlists that have been excluded due to
  // incompatible configurations or playback errors
  const playlists = this.playlists.main.playlists.filter(Playlist.isEnabled);

  // Sort ascending by bitrate
  stableSort(
    playlists,
    (a, b) => comparePlaylistBandwidth(a, b)
  );

  // Parse and assume that playlists with no video codec have no video
  // (this is not necessarily true, although it is generally true).
  //
  // If an entire manifest has no valid videos everything will get filtered
  // out.
  const playlistsWithVideo = playlists.filter(playlist => !!codecsForPlaylist(this.playlists.main, playlist).video);

  return playlistsWithVideo[0] || null;
};
