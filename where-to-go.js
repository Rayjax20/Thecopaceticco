const address='5204 50th Street, Lubbock, TX 79414, United States';
document.getElementById('appleMaps').href=`https://maps.apple.com/?q=${encodeURIComponent(address)}`;
document.getElementById('googleMaps').href=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
