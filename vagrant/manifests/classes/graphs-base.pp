class graphs-base {

    service {
        apache2:
            enable => true,
            ensure => running,
            hasstatus => true,
            #subscribe => Exec[graphs-install],
            require => [Package[apache2], Exec[enable-mod-ssl]];
    }

    file {
	'/etc/hosts':
	    owner => root,
	    group => root,
	    mode => 644,
	    ensure => present,
	    source => "/vagrant/files/hosts";

        '/var/www/graphs':
            owner => graphs,
            group => graphs,
            mode  => 755,
	    recurse => false,
            require => Package[apache2],
	    ensure => directory;

        '/etc/apache2/sites-available/graphs':
            require => Package[apache2],
            alias => 'graphs-vhost',
            owner => root,
            group => root,
            mode  => 644,
            ensure => present,
            notify => Service[apache2],
            source => "/vagrant/files/etc_apache2_sites-available/graphs";

        '/home/graphs':
	    require => User[graphs],
            owner => graphs,
            group => graphs,
            mode  => 775,
	    recurse=> false,
	    ensure => directory;

        '/home/graphs/dev':
	    require => File['/home/graphs'],
            owner => graphs,
            group => graphs,
            mode  => 775,
	    recurse=> false,
	    ensure => directory;

       '/etc/cron.d/graphs':
           owner => root,
           group => root,
           mode => 644,
           require => Exec['install-node-deps'],
           source => "/vagrant/files/etc_crond/graphs";
    }

    package {
        'apache2':
            ensure => latest,
            require => Exec['apt-get-update'];

        'libapache2-mod-wsgi':
            ensure => latest,
            require => [Exec['apt-get-update'], Package[apache2]];

        'git-core':
            ensure => latest,
            require => Exec['apt-get-update'];

        'rsync':
            ensure => latest,
            require => Exec['apt-get-update'];

        'build-essential':
            ensure => latest,
            require => Exec['apt-get-update'];

        'libcairo-dev':
            ensure => latest,
            require => Exec['apt-get-update'];
    }

    user { 'graphs':
	ensure => 'present',
	uid => '10000',
	shell => '/bin/bash',
	managehome => true;
    }

    exec {
        '/usr/bin/apt-get update':
            alias => 'apt-get-update';

        '/usr/sbin/a2ensite graphs':
            alias => 'enable-graphs-vhost',
            creates => '/etc/apache2/sites-enabled/graphs',
            require => File['graphs-vhost'];

        '/usr/sbin/a2enmod ssl':
            alias => 'enable-mod-ssl',
            creates => '/etc/apache2/mods-enabled/ssl.load',
            require => File['graphs-vhost'];

        '/usr/bin/git clone git://github.com/rhelmer/graphs.git':
            alias => 'git-clone',
            user => 'graphs',
            cwd => '/home/graphs/dev/',
            creates => '/home/graphs/dev/graphs',
            require => [Package['git-core'], File['/home/graphs/dev']];

        '/usr/bin/git pull':
            alias => 'git-pull',
            user => 'graphs',
            cwd => '/home/graphs/dev/graphs',
            require => Exec['git-clone'];

        '/usr/bin/rsync -av --exclude=".git" /home/graphs/dev/graphs/ /var/www/graphs/':
            alias => 'graphs-install',
            timeout => '3600',
            require => [User[graphs], Exec[git-pull], Package[rsync], File['/var/www/graphs']],
            user => 'graphs';

        '/usr/bin/wget -N "http://nodejs.org/dist/node-v0.6.8.tar.gz"':
            alias => 'download-node',
            user => 'graphs',
            cwd => '/home/graphs/dev/',
            require => File['/home/graphs/dev'];

        '/bin/tar zxf node-v0.6.8.tar.gz':
            alias => 'unpack-node',
            user => 'graphs',
            cwd => '/home/graphs/dev/',
            creates => '/home/graphs/dev/graphs/node-v0.6.8',
            require => Exec['download-node'];

        '/home/graphs/dev/node-v0.6.8/configure --prefix=/home/graphs/node && /usr/bin/make install':
            alias => 'install-node',
            environment => 'HOME=/home/graphs',
            user => 'graphs',
            cwd => '/home/graphs/dev/node-v0.6.8',
            creates => '/home/graphs/node',
            require => [Exec['unpack-node'], Package['build-essential']];

        '/usr/bin/wget -N "http://registry.npmjs.org/npm/-/npm-1.1.0-2.tgz"':
            alias => 'download-npm',
            user => 'graphs',
            cwd => '/home/graphs/dev/',
            require => Exec['install-node'];

        '/bin/mkdir npm-1.1.0-2 && /bin/tar -C npm-1.1.0-2 -xf npm-1.1.0-2.tgz':
            alias => 'unpack-npm',
            user => 'graphs',
            cwd => '/home/graphs/dev/',
            creates => '/home/graphs/dev/npm-1.1.0-2',
            require => Exec['download-npm'];

        '/usr/bin/make install':
            alias => 'install-npm',
            path => '/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games:/opt/ruby/bin/:/home/graphs/node/bin',
            environment => ['HOME=/home/graphs', 'UID=10000'],
            user => 'graphs',
            cwd => '/home/graphs/dev/npm-1.1.0-2/package',
            require => Exec['unpack-npm'];

        '/home/graphs/node/bin/npm install canvas htmlparser jquery jsdom':
            alias => 'install-node-deps',
            path => '/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games:/opt/ruby/bin/:/home/graphs/node/bin',
            environment => 'HOME=/home/graphs',
            cwd => '/home/graphs/',
            group => 'graphs',
            creates => '/home/graphs/node_modules',
            require => [Exec['install-npm'], Package['libcairo-dev']];
    }
}
