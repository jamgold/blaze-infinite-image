Images = new Meteor.Collection('images');
dynamicLoad = true;

if (Meteor.isClient) {

  number_of_loaded_images = 10;
  scrollTop = 0;
  Session.setDefault('imagesTotal', '*calculating*');
  Session.setDefault('number_of_visible_images', 5);
  Session.setDefault('skip',0);

  Template.hello.number_of_loaded_images = function() {
    return number_of_loaded_images;
  };
  Template.hello.imagesTotal = function() {
    return Session.get('imagesTotal');
  };
  Template.hello.skip = function() {
    return Session.get('skip');
  };

  Template.hello.events({
    'click a.skip': function(e,t) {
      e.preventDefault();
      var skip = Session.get('skip');
      if(e.shiftKey)
      {
        if(skip>0)
         Session.set('skip', skip-1);
        else
          console.log('can not go past 0');
      }
      else
      {
        Session.set('skip', skip+1);
      }
    },
    'click h1': function(e,t) {
      Meteor.call('renumberImages', function(err, result){
        $(e.target).html(result);
      })
    },
    'click span.imagesTotal':function(e,t) {
      Meteor.call('getSomeImages', function(err, result){
        Session.set("imagesTotal", result);
      });
    }
  })

  Template.endless.images = function() {
    return Images.find({},{sort:{n:1}});
  };

  Template.endless.rendered = function() {
    console.log('endless rendered');
    var $w = $(window);
    $w.on('scroll', function(){
      var direction = '';
      var st = $w.scrollTop();
      if(st>scrollTop)
      {
        // down-scroll
        direction = 'up';
      }
      else
      {
        // up-scroll
        direction = 'down';
      }
      scrollTop = st;
      var skip = Session.get('skip');
      var $images = $('ul li');
      // we have n images, focus on the middle one
      var $m = $($images[ parseInt(number_of_loaded_images/2) - 1 ]);
      // $('ul li').removeClass('middle');
      // $m.addClass('middle');
      var t = $m.offset().top - $w.scrollTop();
      console.log(direction+' top='+t+' window.height='+$w.height());
      if(dynamicLoad)
      {
        if(direction == 'down' && t+100>$w.height())
        {
          if(skip > 0)
          {
            // scrollTop = $w.scrollTop();
            Session.set('mode', 'prepend');
            Session.set('skip', skip-1);
          }
        }

        if(direction == 'up' && t <= -0)
        {
          // scrollTop = $w.scrollTop();
          Session.set('mode', 'append');
          Session.set('skip', skip+1);
        }
      }
    })
  };

  Template.image.rendered = function() {
    var id = this.$('li.item').attr('id');
    console.log(id)
  };
  function f(){
    var $w = $(window);
    console.log(this.data.n+' image rendered '+id);
    if(Session.equals('mode','prepend'))
    {
      var t = $('ul li:first').offset().top - $w.scrollTop();
      $w.scrollTop(1);
      $('#endless').prepend($('#'+id));
    }
    else
    {
      $w.scrollTop($w.scrollTop()-1);      
    }
  };

  Template.image.events({
    'click img': function(e, t) {
      var $i = $(e.target).parent();
      var id = $i.attr('id');
        Images.remove({_id: id});
        Meteor.call('imagesTotal', function(err, result){
          Session.set("imagesTotal", result);
        });        
    }
  })

  Meteor.startup(function(){
    Meteor.call('imagesTotal', function(err, result){
      Session.set("imagesTotal", result);
    });
  });

  Deps.autorun(function(){
    Meteor.subscribe('images', number_of_loaded_images, Session.get('skip'), {
      onError: function(){
        console.log('subscription error');
      },
      onReady: function() {
        console.log('subscription ready');
        // $(window).scrollTop(scrollTop);
      }
    });
  });
}

if (Meteor.isServer) {
  //
  // this is the function from the feed we need to provide to
  // process the feed images
  //
  var total;
  function jsonFlickrFeed(a)
  {
    console.log('jsonFlickrFeed '+a.items.length);
    var e = {};
    var n = 1;
    // get existing images to avoid duplicates
    Images.find({},{sort:{n:1}}).forEach(function(i){
      e[i.url] = i;
      n = i.n;
    });
    // now iterate over the the feed
    _.each(a.items, function(i) {
      var url = i.media.m;
      if(url in e)
      {
        console.log(url+' exists');
      }
      else
      {
        Images.insert({url: url,n: ++n});
        e[url] = i;
      }
    });
  };

  function getSomeImages()
  {
    //
    // get images from flickr
    // wget -O - "https://api.flickr.com/services/feeds/photos_public.gne?format=json&id=118281683@N02"
    //
    HTTP.get("https://api.flickr.com/services/feeds/photos_public.gne?format=json", function(error, result){
      if(error)
      {
        console.log(error);
      }
      else
      {
        //
        // this will call jsonFlickrFeed with the results
        //
        eval(result.content);
      }
    });
  };

  Meteor.startup(function () {
    // code to run on server at startup
    if( !Images.findOne() )
    {
      getSomeImages();
    }
  });

  Meteor.publish('images', function(limit, skip){
    skip = skip == undefined ? 0 : skip;
    limit = limit == undefined ? 3 : limit;
    return Images.find({},{limit: limit,skip: skip, sort: {n: 1}});
  });
}

Meteor.methods({
  imagesTotal: function(v) {
    if(this.isSimulation)
    {
      // this runs on the client
      // the return value will be in the result parameter of the async callback
      return "counting images";
    }
    else
    {
      // the return value will be in the result parameter of the async callback
      return Images.find().count();
    }
  },
  getSomeImages: function() {
    if(this.isSimulation)
    {
      return "getting some images";
    }
    else
    {
      getSomeImages();
      return Images.find().count();
    }
  },
  renumberImages: function() {
    if(this.isSimulation)
    {
      $('h1').html('Renumbering!');
      return "renumbering";
    }
    else
    {
      var n = 1;
      Images.find({},{sort:{n:1}}).forEach(function(image){
        console.log(image._id+' now '+n);
        Images.update({_id:image._id},{$set: {n: n++}});
      });
      return "Endless Images!";
    }
  }
});
